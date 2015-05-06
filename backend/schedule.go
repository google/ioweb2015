package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"reflect"
	"sort"
	"strings"
	"sync"
	"time"

	"golang.org/x/net/context"
)

const (
	liveStreamedText = "Live streamed"
	gcsReadOnlyScope = "https://www.googleapis.com/auth/devstorage.read_only"
)

type eventData struct {
	Sessions map[string]*eventSession `json:"sessions,omitempty"`
	Speakers map[string]*eventSpeaker `json:"speakers,omitempty"`
	Videos   map[string]*eventVideo   `json:"video_library,omitempty"`
	Tags     map[string]*eventTag     `json:"tags,omitempty"`
	// not exposed
	rooms    map[string]*eventRoom
	modified time.Time
	etag     string
}

type eventSession struct {
	Id         string    `json:"id"`
	Title      string    `json:"title"`
	Desc       string    `json:"description"`
	StartTime  time.Time `json:"startTimestamp"`
	EndTime    time.Time `json:"endTimestamp"`
	IsLive     bool      `json:"isLivestream"`
	Tags       []string  `json:"tags"`
	Speakers   []string  `json:"speakers"`
	Room       string    `json:"room"`
	Photo      string    `json:"photoUrl,omitempty"`
	YouTube    string    `json:"youtubeUrl,omitempty"`
	HasRelated bool      `json:"hasRelated"`
	Related    []*struct {
		Id string `json:"id"`
	} `json:"relatedContent,omitempty"`

	Day     int             `json:"day"`
	Block   string          `json:"block"`
	Start   string          `json:"start"`
	End     string          `json:"end"`
	Filters map[string]bool `json:"filters"`

	// Update is used only when diff-ing
	Update string `json:"update,omitempty"`
}

type eventSpeaker struct {
	Id      string `json:"id"`
	Name    string `json:"name"`
	Bio     string `json:"bio,omitempty"`
	Company string `json:"company,omitempty"`
	Thumb   string `json:"thumbnailUrl,omitempty"`
	Plusone string `json:"plusoneUrl,omitempty"`
	Twitter string `json:"twitterUrl,omitempty"`
}

type eventVideo struct {
	Id       string `json:"id"`
	Title    string `json:"title"`
	Desc     string `json:"desc,omitempty"`
	Topic    string `json:"topic,omitempty"`
	Speakers string `json:"speakers,omitempty"`
	Thumb    string `json:"thumbnailUrl,omitempty"`
	// TODO: past_video_library has it as string,
	//       while video_library is int.
	Year int `json:"year"`
}

type eventRoom struct {
	Id   string `json:"id"`
	Name string `json:"name"`
}

type eventTag struct {
	Order int    `json:"order_in_category"`
	Tag   string `json:"tag"`
	Name  string `json:"name"`
	Cat   string `json:"category"`
}

// isEmptyEventData returns true if d is nil or its exported fields contain no items.
func isEmptyEventData(d *eventData) bool {
	return d == nil || (len(d.Sessions) == 0 && len(d.Speakers) == 0 && len(d.Videos) == 0 && len(d.Tags) == 0)
}

// fetchEventData retrieves complete event data starting from manifest at url.
// If the manifest has not changed since lastSync, both returned values are nil.
func fetchEventData(c context.Context, urlStr string, lastSync time.Time) (*eventData, error) {
	u, err := url.Parse(urlStr)
	if err != nil {
		return nil, err
	}
	hc, err := serviceAccountClient(c, gcsReadOnlyScope)
	if err != nil {
		return nil, fmt.Errorf("fetchEventData: %v", err)
	}

	files, lastMod, err := fetchEventManifest(c, hc, u.String(), lastSync)
	if err != nil {
		return nil, err
	}
	if len(files) == 0 {
		return nil, nil
	}

	// base file URLs off manifest location
	base := path.Dir(u.Path)

	var mu sync.Mutex  // guards chunks and slurpErr
	var slurpErr error // last slurp error, if any
	chunks := make([]*eventData, 0, len(files))

	// fetch all files in the manifest in parallel
	var wg sync.WaitGroup
	for _, f := range files {
		u.Path = path.Join(base, f)
		wg.Add(1)
		go func(u string) {
			defer wg.Done()
			res, err := slurpEventDataChunk(c, hc, u)
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				errorf(c, "slurpEventDataChunk(%q): %v", u, err)
				slurpErr = err
				return
			}
			chunks = append(chunks, res)
		}(u.String())
	}

	wg.Wait()
	if slurpErr != nil {
		return nil, slurpErr
	}

	rooms := make(map[string]*eventRoom)
	data := &eventData{
		Tags:     make(map[string]*eventTag),
		Speakers: make(map[string]*eventSpeaker),
		Videos:   make(map[string]*eventVideo),
		Sessions: make(map[string]*eventSession),
		modified: lastMod,
	}

	for _, chunk := range chunks {
		for k, v := range chunk.rooms {
			rooms[k] = v
		}
		for k, v := range chunk.Tags {
			data.Tags[k] = v
		}
	}

	for _, chunk := range chunks {
		for k, v := range chunk.Speakers {
			data.Speakers[k] = v
		}
		for k, v := range chunk.Videos {
			data.Videos[k] = v
		}
		for id, s := range chunk.Sessions {
			if r, ok := rooms[s.Room]; ok {
				s.Room = r.Name
			}
			s.Filters = make(map[string]bool)
			s.Filters[liveStreamedText] = s.IsLive
			for _, t := range s.Tags {
				if tag, ok := data.Tags[t]; ok {
					s.Filters[tag.Name] = true
				}
			}
			for _, r := range s.Related {
				s.Filters[r.Id] = true
			}
			s.HasRelated = len(s.Related) > 0
			s.Related = nil
			data.Sessions[id] = s
		}
	}

	return data, nil
}

// fetchEventManifest retrieves a list of URLs containing event schedule data.
// url should point to the manifest.json file.
// Returned Time is the timestamp of last modification.
// If data hasn't changed since lastSync, both returned values are nil.
func fetchEventManifest(c context.Context, hc *http.Client, url string, lastSync time.Time) ([]string, time.Time, error) {
	logf(c, "fetching manifest from %s", url)
	mod := time.Now()

	r, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, mod, err
	}
	r.Header.Set("if-modified-since", lastSync.UTC().Format(http.TimeFormat))
	res, err := hc.Do(r)
	if err != nil {
		return nil, mod, err
	}
	defer res.Body.Close()
	if res.StatusCode == http.StatusNotModified {
		return nil, mod, nil
	}
	if res.StatusCode != http.StatusOK {
		return nil, mod, fmt.Errorf("fetchEventManifest: %s", res.Status)
	}
	t, err := time.ParseInLocation(http.TimeFormat, res.Header.Get("last-modified"), time.UTC)
	if err == nil {
		mod = t
	}

	var data struct {
		Files []string `json:"data_files"`
	}
	if err := json.NewDecoder(res.Body).Decode(&data); err != nil {
		return nil, mod, err
	}

	files := data.Files[:0]
	for _, f := range data.Files {
		if strings.HasPrefix(f, "past_io_videolibrary") {
			continue
		}
		files = append(files, f)
	}
	return files, mod, err
}

// slurpEventDataChunk retrieves a chunk of event data at url
// any, all or none of the returned *eventData fields can be non-empty.
func slurpEventDataChunk(c context.Context, hc *http.Client, url string) (*eventData, error) {
	logf(c, "slurping %s", url)
	res, err := hc.Get(url)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fetchEventSchedule(%q): %v", url, err)
	}

	var body struct {
		Sessions []*eventSession `json:"sessions"`
		Rooms    []*eventRoom    `json:"rooms"`
		Tags     []*eventTag     `json:"tags"`
		Videos   []*eventVideo   `json:"video_library"`
		Speakers []*eventSpeaker `json:"speakers"`
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
		if s.Id == "" || s.StartTime.Before(config.Schedule.Start) {
			continue
		}

		tzstart := s.StartTime.In(config.Schedule.Location)
		s.Block = tzstart.Format("3 PM")
		s.Start = tzstart.Format("3:04 PM")
		s.End = s.EndTime.In(config.Schedule.Location).Format("3:04 PM")
		s.Day = tzstart.Day()

		if len(s.Speakers) == 0 {
			s.Speakers = nil
		}
		if len(s.Tags) == 0 {
			s.Tags = nil
		}

		sessions[s.Id] = s
	}

	videos := make(map[string]*eventVideo, len(body.Videos))
	for _, v := range body.Videos {
		if v.Id == "" {
			continue
		}
		videos[v.Id] = v
	}

	speakers := make(map[string]*eventSpeaker, len(body.Speakers))
	for _, s := range body.Speakers {
		if s.Id == "" {
			continue
		}
		speakers[s.Id] = s
	}

	return &eventData{
		Sessions: sessions,
		Speakers: speakers,
		Videos:   videos,
		Tags:     tags,
		rooms:    rooms,
	}, nil
}

// diffEventData looks for changes in existing items of b comparing to a.
// It compares only Sessions, Speakers and Videos of eventData.
// The result is a subset of b or nil if a is empty.
// Side effects: Update field of b.Session elements may be modified;
// Tags and Speakers fields will be assigned nil if len() == 0.
func diffEventData(a, b *eventData) *dataChanges {
	if isEmptyEventData(a) {
		return nil
	}
	dc := &dataChanges{
		Updated: b.modified,
		eventData: eventData{
			Sessions: make(map[string]*eventSession),
			Speakers: make(map[string]*eventSpeaker),
			Videos:   make(map[string]*eventVideo),
		},
	}
	for id, bs := range b.Sessions {
		as, ok := a.Sessions[id]
		if !ok {
			continue
		}
		if len(as.Speakers) == 0 {
			as.Speakers = nil
		}
		if len(as.Tags) == 0 {
			as.Tags = nil
		}
		if len(bs.Speakers) == 0 {
			bs.Speakers = nil
		}
		if len(bs.Tags) == 0 {
			bs.Tags = nil
		}
		if !reflect.DeepEqual(as, bs) {
			dc.Sessions[id] = bs
			bs.Update = updateDetails
			if as.YouTube != bs.YouTube && bs.YouTube != "" {
				bs.Update = updateVideo
			}
		}
	}
	for id, bs := range b.Speakers {
		if as, ok := a.Speakers[id]; ok && !reflect.DeepEqual(as, bs) {
			dc.Speakers[id] = bs
		}
	}
	for id, bs := range b.Videos {
		if as, ok := a.Videos[id]; ok && !reflect.DeepEqual(as, bs) {
			dc.Videos[id] = bs
		}
	}
	return dc
}

// userSchedule returns a slice of session IDs bookmarked by a user.
// It fetches data from Google Drive AppData folder associated with config.Google.Auth.Client.
func userSchedule(c context.Context, uid string) ([]string, error) {
	cred, err := getCredentials(c, uid)
	if err != nil {
		return nil, err
	}
	var data *appFolderData
	if data, err = getAppFolderData(c, cred, false); err != nil {
		return nil, err
	}
	return data.Bookmarks, nil
}

// bookmarkSessions adds session IDs ids to the bookmarks of user uid.
func bookmarkSessions(c context.Context, uid string, ids ...string) ([]string, error) {
	cred, err := getCredentials(c, uid)
	if err != nil {
		return nil, fmt.Errorf("bookmarkSessions: %v", err)
	}

	var data *appFolderData
	for _, fresh := range []bool{false, true} {
		data, err = getAppFolderData(c, cred, fresh)
		if err != nil {
			break
		}
		data.Bookmarks = unique(append(data.Bookmarks, ids...))
		err = storeAppFolderData(c, cred, data)
		if err != errConflict {
			break
		}
	}

	if err != nil {
		return nil, fmt.Errorf("bookmarkSessions: %v", err)
	}
	return data.Bookmarks, nil
}

// unbookmarkSessions is the opposite of bookmarkSessions.
func unbookmarkSessions(c context.Context, uid string, ids ...string) ([]string, error) {
	cred, err := getCredentials(c, uid)
	if err != nil {
		return nil, fmt.Errorf("unbookmarkSessions: %v", err)
	}

	var data *appFolderData
	for _, fresh := range []bool{false, true} {
		data, err = getAppFolderData(c, cred, fresh)
		if err != nil {
			break
		}
		data.Bookmarks = subslice(data.Bookmarks, ids...)
		err = storeAppFolderData(c, cred, data)
		if err != errConflict {
			break
		}
	}

	if err != nil {
		return nil, fmt.Errorf("unbookmarkSessions: %v", err)
	}
	return data.Bookmarks, nil
}

// unique removes duplicates from slice.
// Original arg is not modified.
func unique(items []string) []string {
	seen := make(map[string]bool, len(items))
	res := make([]string, 0, len(items))
	for _, s := range items {
		if !seen[s] {
			res = append(res, s)
			seen[s] = true
		}
	}
	return res
}

// subslice returns a subset of src which does not contain items.
// Returned slice may have an order of elements different from src.
func subslice(src []string, items ...string) []string {
	res := make([]string, len(src))
	copy(res, src)
	sort.Strings(res)
	for _, s := range items {
		i := sort.SearchStrings(res, s)
		if i < len(res) && res[i] == s {
			res = append(res[:i], res[i+1:]...)
		}
	}
	return res
}
