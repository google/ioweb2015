package main

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"golang.org/x/net/context"
)

type sessionSurvey struct {
	Overall   *int    `json:"overall"`
	Relevance *int    `json:"relevance"`
	Content   *int    `json:"content"`
	Speaker   *int    `json:"speaker"`
	Comment   *string `json:"comment"`
}

// valid validates sessionSurvey data.
func (s *sessionSurvey) valid() bool {
	for _, x := range []*int{s.Overall, s.Relevance, s.Content, s.Speaker} {
		if x != nil && (*x < 1 || *x > 5) {
			return false
		}
	}
	return true
}

func (s *sessionSurvey) String() string {
	data := map[string]*int{
		"overall":   s.Overall,
		"relevance": s.Relevance,
		"content":   s.Content,
		"speaker":   s.Speaker,
	}
	res := make([]string, 0, len(data)+1)
	for k, v := range data {
		i := -1
		if v != nil {
			i = *v
		}
		res = append(res, fmt.Sprintf("%s=%d", k, i))
	}
	if s.Comment != nil {
		res = append(res, *s.Comment)
	}
	return strings.Join(res, " ")
}

// submittedSurveySessions returns a slice of session IDs which user uid
// has already submitted a feedback survey for.
// It fetches data from Google Drive AppData folder.
func submittedSurveySessions(c context.Context, uid string) ([]string, error) {
	cred, err := getCredentials(c, uid)
	if err != nil {
		return nil, err
	}
	var data *appFolderData
	if data, err = getAppFolderData(c, cred, false); err != nil {
		return nil, err
	}
	return data.Survey, nil
}

// addSessionSurvey adds session sid to the feedback survey list of user uid.
// It returns a list of all sessions the user has submitted a feedback for, including sid.
// If the user has already submitted a feedback for sid, errBadData is returned.
func addSessionSurvey(c context.Context, uid, sid string) ([]string, error) {
	perr := prefixedErr("addSessionSurvey")
	cred, err := getCredentials(c, uid)
	if err != nil {
		return nil, perr(err)
	}

	var data *appFolderData
	for _, fresh := range []bool{false, true} {
		if data, err = getAppFolderData(c, cred, fresh); err != nil {
			break
		}
		// prevent double submission
		sort.Strings(data.Survey)
		i := sort.SearchStrings(data.Survey, sid)
		if i < len(data.Survey) && data.Survey[i] == sid {
			return nil, errBadData
		}
		// accept only ids in the user's bookmarks
		sort.Strings(data.Bookmarks)
		i = sort.SearchStrings(data.Bookmarks, sid)
		if i >= len(data.Bookmarks) || data.Bookmarks[i] != sid {
			return nil, errNotFound
		}
		data.Survey = append(data.Survey, sid)
		err = storeAppFolderData(c, cred, data)
		if err != errConflict {
			break
		}
	}

	if err != nil {
		return nil, perr(err)
	}
	return data.Survey, nil
}

// submitSessionSurvey sends a request to config.Survey.Endpoint with s data
// according to https://api.eventpoint.com/2.3/Home/REST#evals docs.
func submitSessionSurvey(c context.Context, sid string, s *sessionSurvey) error {
	perr := prefixedErr("submitSessionSurvey")
	r, err := http.NewRequest("GET", config.Survey.Endpoint, nil)
	if err != nil {
		return perr(err)
	}
	q := r.URL.Query()
	setQ := func(n string, v *int) {
		if v == nil {
			return
		}
		q.Set(n, strconv.Itoa(*v))
	}
	q.Set("objectid", sid)
	q.Set("surveyId", config.Survey.ID)
	q.Set("registrantKey", config.Survey.Reg)
	setQ("q1", s.Overall)
	setQ("q2", s.Relevance)
	setQ("q3", s.Content)
	setQ("q4", s.Speaker)
	if s.Comment != nil {
		q.Set("q5", *s.Comment)
	}
	r.URL.RawQuery = q.Encode()
	r.Header.Set("apikey", config.Survey.Key)
	r.Header.Set("code", config.Survey.Code)
	res, err := httpClient(c).Do(r)
	if err != nil {
		return perr(err)
	}
	defer res.Body.Close()
	if res.StatusCode == http.StatusOK {
		return nil
	}
	b, _ := ioutil.ReadAll(res.Body)
	return perr(res.Status + ": " + string(b))
}
