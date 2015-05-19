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
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"mime/multipart"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	"golang.org/x/net/context"
)

var defaultBookmarks = []string{"__keynote__"}

type appFolderData struct {
	// datastore
	FileID string `json:"-" datastore:"fid,noindex"`
	Etag   string `json:"-" datastore:"etag,noindex"`
	// appdata JSON content
	ExtKey    string   `json:"gcm_key" datastore:"-"`
	Bookmarks []string `json:"starred_sessions" datastore:"-"`
	Videos    []string `json:"viewed_videos" datastore:"-"`
	Survey    []string `json:"feedback_submitted_sessions" datastore:"-"`
}

// getAppFolderData returns appfolder data of cred.userID, previously uploaded
// to user_data.json file in gdrive AppFolder.
// The metadata are fetched from either a local storage or network.
// Resulting appFolderData will have zero-valued FileID, zero-valued Etag
// and a copy of defaultBookmarks if the file doesn't exist yet.
func getAppFolderData(c context.Context, cred *oauth2Credentials, fresh bool) (*appFolderData, error) {
	perr := prefixedErr("getAppFolderData")
	hc := oauth2Client(c, cred.tokenSource(c))
	// get file ID and etag
	var (
		data *appFolderData
		err  error = errNotFound
	)
	if !fresh {
		data, err = getLocalAppFolderMeta(c, cred.userID)
	}
	if err != nil {
		// fallback to drive API if either fresh == true or datastore error
		data, err = fetchAppFolderMeta(hc)
	}
	if err != nil {
		// return the original error here
		// which can be errAuth*
		return nil, err
	}
	if data.FileID == "" {
		// default appdata file, return as is
		return data, nil
	}

	// fetch the actual contents of user_data.json file
	req, err := http.NewRequest("GET", config.Google.Drive.FilesURL, nil)
	if err != nil {
		return nil, perr(err)
	}
	req.URL.Path = path.Join(req.URL.Path, data.FileID)
	req.URL.RawQuery = "alt=media"
	res, err := hc.Do(req)
	if err != nil {
		return nil, perr(err)
	}
	defer res.Body.Close()
	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return nil, perr(err)
	}
	if res.StatusCode != http.StatusOK {
		errorf(c, "Get %s: %s", req.URL, body)
		return nil, perr(res.Status)
	}
	return data, json.Unmarshal(body, data)
}

// fetchAppFolderMeta uses drive API to search for a user_data.json file in 'appfolder'.
// It returns data with only FileID and Etag set when found, otherwise an empty one
// with pre-populated default bookmarks slice.
func fetchAppFolderMeta(hc *http.Client) (*appFolderData, error) {
	perr := prefixedErr("fetchAppFolderMeta")
	q := fmt.Sprintf("'appfolder' in parents and title = '%s'", config.Google.Drive.Filename)
	params := url.Values{
		"q":          {q},
		"fields":     {"nextPageToken,items(etag,id,modifiedDate)"},
		"maxResults": {"100"},
	}
	res, err := hc.Get(config.Google.Drive.FilesURL + "?" + params.Encode())
	if err != nil {
		// return the original error here
		// which may be errAuth*
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, perr(res.Status)
	}

	var body struct {
		NextPageToken string `json:"nextPageToken"`
		Items         []struct {
			Etag         string `json:"etag"`
			ID           string `json:"id"`
			ModifiedDate string `json:"modifiedDate"`
		} `json:"items"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		return nil, perr(err)
	}
	// find the most recently updated user_data.json in case there are many
	idx := -1
	var mdate time.Time
	for i, item := range body.Items {
		t, err := time.Parse(time.RFC3339Nano, item.ModifiedDate)
		if err != nil {
			continue
		}
		if t.After(mdate) {
			mdate = t
			idx = i
		}
	}

	data := &appFolderData{}
	if idx < 0 {
		// use default bookmarks if appdata doesn't exist yet
		data.Bookmarks = append([]string{}, defaultBookmarks...)
	} else {
		data.FileID = body.Items[idx].ID
		data.Etag = strings.Trim(body.Items[idx].Etag, `"`)
	}
	return data, nil
}

// storeAppFolderData uploads data using drive API, updates data.Etag with the new value
// and saves this info using storeLocalAppFolderMeta() func.
func storeAppFolderData(c context.Context, cred *oauth2Credentials, data *appFolderData) error {
	hc := oauth2Client(c, cred.tokenSource(c))
	// upload to gdrive
	var err error
	if data.FileID == "" {
		err = createAppFolderData(hc, data)
	} else {
		err = updateAppFolderData(hc, data)
	}
	if err != nil {
		return err
	}

	// save new etag locally for next requests
	if err := storeLocalAppFolderMeta(c, cred.userID, data); err != nil {
		// if this fails, don't return the error: drive API call already succeeded,
		// which is our primary goal here. worst case scenario is we'll have
		// an outdated etag which we'll update on the next round trip.
		errorf(c, err.Error())
	}

	// notify iosched if this user also uses android
	if data.ExtKey == "" {
		return nil
	}
	if err := pingExtPartyAsync(c, data.ExtKey); err != nil {
		// same reason to not return the error as with storeLocalAppFolderMeta().
		errorf(c, err.Error())
	}
	return nil
}

// updateAppFolderData uploads data as application/json file to data.FileID
// using 'media' upload type of drive API.
// It modifies Etag field of data arg to contain updated value.
// If remote data changed in the meantime, the returned error value is errConflict.
func updateAppFolderData(hc *http.Client, data *appFolderData) error {
	perr := prefixedErr("updateAppFolderData")
	body, err := json.Marshal(data)
	if err != nil {
		return perr(err)
	}
	r, err := http.NewRequest("PUT", config.Google.Drive.UploadURL, bytes.NewReader(body))
	if err != nil {
		return perr(err)
	}
	r.URL.Path = path.Join(r.URL.Path, data.FileID)
	r.URL.RawQuery = "uploadType=media"
	r.Header.Set("content-type", "application/json")
	r.Header.Set("if-match", `"`+data.Etag+`"`)
	res, err := hc.Do(r)
	if err != nil {
		return perr(err)
	}
	defer res.Body.Close()
	if res.StatusCode == http.StatusPreconditionFailed {
		return errConflict
	}
	if res.StatusCode > 299 {
		return perr(res.Status)
	}
	data.Etag = strings.Trim(res.Header.Get("etag"), `"`)
	return nil
}

// createAppFolderData uploads data as application/json content along with metadata
// using 'multipart' upload type of drive API.
// It modifies FileID and Etag fields of data arg to contain updated values.
func createAppFolderData(hc *http.Client, data *appFolderData) error {
	perr := prefixedErr("createAppFolderData")
	var body bytes.Buffer
	mp := multipart.NewWriter(&body)

	// metadata
	pw, err := mp.CreatePart(typeMimeHeader("application/json"))
	if err != nil {
		return perr(err)
	}
	meta := fmt.Sprintf(`{
    "title": %q,
    "mimeType": "application/json",
    "parents": [{"id": "appfolder"}]
  }`, config.Google.Drive.Filename)
	pw.Write([]byte(meta))

	// media content
	pw, err = mp.CreatePart(typeMimeHeader("application/json"))
	if err != nil {
		return perr(err)
	}
	b, err := json.Marshal(data)
	if err != nil {
		return perr(err)
	}
	pw.Write(b)
	mp.Close()

	// make the HTTP request
	r, err := http.NewRequest("POST", config.Google.Drive.UploadURL+"?uploadType=multipart", &body)
	if err != nil {
		return perr(err)
	}
	r.Header.Set("content-type", "multipart/related; boundary="+mp.Boundary())
	res, err := hc.Do(r)
	if err != nil {
		return perr(err)
	}
	defer res.Body.Close()
	if res.StatusCode > 299 {
		return perr(res.Status)
	}

	// get the newly created file ID and etag
	resbody := struct {
		Id string `json:"id"`
	}{}
	if err := json.NewDecoder(res.Body).Decode(&resbody); err != nil {
		return perr(err)
	}
	data.FileID = resbody.Id
	data.Etag = strings.Trim(res.Header.Get("etag"), `"`)
	return nil
}
