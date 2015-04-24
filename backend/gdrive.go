package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"time"

	"golang.org/x/net/context"
)

const searchDriveFiles = "'appfolder' in parents and title = '%s' and trashed = false"

type appFolderData struct {
	// id indicates whether the file exists
	id string

	ExtKey    string   `json:"gcm_key"`
	Bookmarks []string `json:"starred_sessions"`
	Videos    []string `json:"viewed_videos"`
	Feedback  []string `json:"feedback_submitted_sessions"`
}

func fetchAppFolderData(c context.Context, cred *oauth2Credentials) (*appFolderData, error) {
	// list files in 'appfolder' with title 'user_data.json'
	// TODO: cache appdata file ID so not to query every time.
	hc := oauth2Client(c, cred.tokenSource(c))
	params := url.Values{
		"q":          {fmt.Sprintf(searchDriveFiles, config.Google.Drive.Filename)},
		"fields":     {"nextPageToken,items(id,downloadUrl,modifiedDate)"},
		"maxResults": {"100"},
	}
	res, err := hc.Get(config.Google.Drive.FilesURL + "?" + params.Encode())
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fetchAppFolderData: %s", res.Status)
	}

	// find the most recently updated user_data.json in case there are many
	var body struct {
		NextPageToken string `json:"nextPageToken"`
		Items         []struct {
			ID           string `json:"id"`
			ModifiedDate string `json:"modifiedDate"`
			DownloadURL  string `json:"downloadUrl"`
		} `json:"items"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("fetchAppFolderData: %v", err)
	}

	var fileID, fileURL string
	var mdate time.Time

	for _, item := range body.Items {
		t, err := time.Parse(time.RFC3339Nano, item.ModifiedDate)
		if err != nil {
			continue
		}
		if t.After(mdate) && item.DownloadURL != "" {
			mdate = t
			fileID = item.ID
			fileURL = item.DownloadURL
		}
	}

	// get the file contents or return an empty if none exists
	data := &appFolderData{}

	if fileURL == "" {
		logf(c, "fetchAppFolderData: file not found")
		return data, nil
	}

	if res, err = hc.Get(fileURL); err != nil {
		return nil, err
	}
	defer res.Body.Close()
	data.id = fileID
	return data, json.NewDecoder(res.Body).Decode(data)
}

func storeAppFolderData(c context.Context, cred *oauth2Credentials, data *appFolderData) error {
	// request payload
	var body bytes.Buffer
	mp := multipart.NewWriter(&body)

	// metadata
	pw, err := mp.CreatePart(typeMimeHeader("application/json"))
	if err != nil {
		return err
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
		return err
	}
	b, err := json.Marshal(data)
	if err != nil {
		return err
	}
	pw.Write(b)
	mp.Close()

	// construct HTTP request
	m, url := "POST", config.Google.Drive.UploadURL
	if data.id != "" {
		m = "PUT"
		url += "/" + data.id
	}
	r, err := http.NewRequest(m, url+"?uploadType=multipart", &body)
	if err != nil {
		return err
	}
	r.Header.Set("Content-Type", "multipart/related; boundary="+mp.Boundary())

	// make the actual request
	res, err := oauth2Client(c, cred.tokenSource(c)).Do(r)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode > 299 {
		return errors.New("storeAppFolderData: " + res.Status)
	}

	// notify extra parties
	if err := pingExtPartyAsync(c, data.ExtKey); err != nil {
		errorf(c, "storeAppFolderData: %v", err)
	}
	return nil
}

func typeMimeHeader(contentType string) textproto.MIMEHeader {
	h := make(textproto.MIMEHeader)
	h.Set("Content-Type", contentType)
	return h
}
