// Copyright 2015 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"sort"

	"golang.org/x/net/context"
)

type sessionSurvey struct {
	Overall   string `json:"overall"`
	Relevance string `json:"relevance"`
	Content   string `json:"content"`
	Speaker   string `json:"speaker"`
	Comment   string `json:"comment"`
}

// valid validates sessionSurvey data.
func (s *sessionSurvey) valid() bool {
	if s.Overall != "" && config.Survey.Qmap.Q1.Answers[s.Overall] == "" {
		return false
	}
	if s.Relevance != "" && config.Survey.Qmap.Q2.Answers[s.Relevance] == "" {
		return false
	}
	if s.Content != "" && config.Survey.Qmap.Q3.Answers[s.Content] == "" {
		return false
	}
	if s.Speaker != "" && config.Survey.Qmap.Q4.Answers[s.Speaker] == "" {
		return false
	}
	return true
}

func (s *sessionSurvey) String() string {
	return fmt.Sprintf("o=%s r=%s c=%s s=%s %s",
		s.Overall, s.Relevance, s.Content, s.Speaker, s.Comment)
}

// disabledSurvey returns true if sid is found in config.Survey.Disabled.
func disabledSurvey(sid string) bool {
	if sid == "" {
		return true
	}
	i := sort.SearchStrings(config.Survey.Disabled, sid)
	return i < len(config.Survey.Disabled) && config.Survey.Disabled[i] == sid
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
	if v, ok := config.Survey.Smap[sid]; ok {
		sid = v
	}
	q := r.URL.Query()
	q.Set(config.Survey.Qmap.Q1.Name, config.Survey.Qmap.Q1.Answers[s.Overall])
	q.Set(config.Survey.Qmap.Q2.Name, config.Survey.Qmap.Q2.Answers[s.Relevance])
	q.Set(config.Survey.Qmap.Q3.Name, config.Survey.Qmap.Q3.Answers[s.Content])
	q.Set(config.Survey.Qmap.Q4.Name, config.Survey.Qmap.Q4.Answers[s.Speaker])
	q.Set(config.Survey.Qmap.Q5.Name, s.Comment)
	q.Set("surveyId", config.Survey.ID)
	q.Set("registrantKey", config.Survey.Reg)
	q.Set("objectid", sid)
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
