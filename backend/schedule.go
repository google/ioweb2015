package main

import (
	"sort"

	"golang.org/x/net/context"
)

const (
	appFolderFile = "user_data.json"

	driveFilesURL  = "https://www.googleapis.com/drive/v2/files"
	driveUploadURL = "https://www.googleapis.com/upload/drive/v2/files"
)

type appFolderData struct {
	// id indicates whether the file exists
	id string

	GCMKey    string   `json:"gcm_key"`
	Bookmarks []string `json:"starred_sessions"`
	Videos    []string `json:"viewed_videos"`
	Feedback  []string `json:"feedback_submitted_sessions"`
}

// userSchedule returns a slice of session IDs bookmarked by a user.
// It fetches data from Google Drive AppData folder associated with config.Google.Auth.Client.
// Context c must include user ID.
func userSchedule(c context.Context) ([]string, error) {
	cred, err := getCredentials(c)
	if err != nil {
		return nil, err
	}
	var data *appFolderData
	if data, err = fetchAppFolderData(c, cred); err != nil {
		return nil, err
	}
	return data.Bookmarks, nil
}

func bookmarkSession(c context.Context, id string) error {
	cred, err := getCredentials(c)
	if err != nil {
		return err
	}
	var data *appFolderData
	if data, err = fetchAppFolderData(c, cred); err != nil {
		return err
	}

	// check for duplicates
	sort.Strings(data.Bookmarks)
	i := sort.SearchStrings(data.Bookmarks, id)
	if i < len(data.Bookmarks) && data.Bookmarks[i] == id {
		return nil
	}

	data.Bookmarks = append(data.Bookmarks, id)
	return storeAppFolderData(c, cred, data)
}

func unbookmarkSession(c context.Context, id string) error {
	cred, err := getCredentials(c)
	if err != nil {
		return err
	}
	var data *appFolderData
	if data, err = fetchAppFolderData(c, cred); err != nil {
		return err
	}

	// remove id in question w/o sorting
	list := data.Bookmarks[:0]
	for _, item := range data.Bookmarks {
		if item != id {
			list = append(list, item)
		}
	}
	// no need to make a roundtrip if id wasn't in the list
	if len(list) == len(data.Bookmarks) {
		return nil
	}

	data.Bookmarks = list
	return storeAppFolderData(c, cred, data)
}
