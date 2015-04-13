package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"time"

	"golang.org/x/net/context"
)

type eventData struct {
	Sessions map[string]*eventSession `json:"sessions"`
	Speakers map[string]interface{}   `json:"speakers"`
	Videos   map[string]interface{}   `json:"video_library"`
	Tags     map[string]*eventTag     `json:"tags"`
}

type eventSession struct {
	Id        string    `json:"id"`
	Title     string    `json:"title"`
	Desc      string    `json:"description"`
	StartTime time.Time `json:"startTimestamp"`
	EndTime   time.Time `json:"endTimestamp"`
	IsLive    bool      `json:"isLivestream"`
	Tags      []string  `json:"tags"`
	Speakers  []string  `json:"speakers"`
	Room      string    `json:"room"`
	Photo     string    `json:"photoUrl,omitempty"`
	YouTube   string    `json:"youtubeUrl,omitempty"`

	Day     int             `json:"day"`
	Block   string          `json:"block"`
	Start   string          `json:"start"`
	End     string          `json:"end"`
	Filters map[string]bool `json:"filters"`
}

type eventRoom struct {
	Id   string `json:"id"`
	Name string `json:"name"`
}

type eventTag struct {
	Tag  string `json:"tag"`
	Name string `json:"name"`
	Cat  string `json:"category"`
}

func fetchEventSchedule(c context.Context, url string) (*eventData, error) {
	res, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fetchEventSchedule(%q): %v", url, err)
	}

	var body struct {
		Sessions []*eventSession          `json:"sessions"`
		Rooms    []*eventRoom             `json:"rooms"`
		Tags     []*eventTag              `json:"tags"`
		Videos   []map[string]interface{} `json:"video_library"`
		Speakers []map[string]interface{} `json:"speakers"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		return nil, err
	}

	rooms := make(map[string]*eventRoom, len(body.Rooms))
	for _, r := range body.Rooms {
		rooms[r.Id] = r
	}

	tags := make(map[string]*eventTag, len(body.Tags))
	for _, t := range body.Tags {
		tags[t.Tag] = t
	}

	sessions := make(map[string]*eventSession, len(body.Sessions))
	for _, s := range body.Sessions {
		if s.Id == "" {
			continue
		}
		if r, ok := rooms[s.Room]; ok {
			s.Room = r.Name
		}

		s.Filters = make(map[string]bool)
		s.Filters["Live Streamed"] = s.IsLive
		for _, t := range s.Tags {
			if tag, ok := tags[t]; ok {
				s.Filters[tag.Name] = true
			}
		}

		tzstart := s.StartTime.In(config.Schedule.Location)
		s.Block = tzstart.Format("03 PM")
		s.Start = tzstart.Format("03:04 PM")
		s.End = s.EndTime.In(config.Schedule.Location).Format("03:04 PM")

		d := s.StartTime.Sub(config.Schedule.Start)
		s.Day = 1 + int(d/24/time.Hour)

		sessions[s.Id] = s
	}

	videos := make(map[string]interface{}, len(body.Videos))
	for _, v := range body.Videos {
		id, ok := v["id"].(string)
		if !ok || id == "" {
			continue
		}
		delete(v, "vid")
		videos[id] = v
	}

	speakers := make(map[string]interface{}, len(body.Speakers))
	for _, s := range body.Speakers {
		id, ok := s["id"].(string)
		if !ok || id == "" {
			continue
		}
		speakers[id] = s
	}

	return &eventData{
		Sessions: sessions,
		Speakers: speakers,
		Videos:   videos,
		Tags:     tags,
	}, nil
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
