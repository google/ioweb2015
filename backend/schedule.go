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
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"reflect"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/net/context"
)

const (
	liveStreamedText = "Live streamed"
	keynoteID        = "__keynote__"

	// sessionUpdates for updateSoon, updateStart and updateSurvey
	timeoutSoon   = 24 * time.Hour
	timeoutStart  = 10 * time.Minute
	timeoutSurvey = 4*24*time.Hour + 30*time.Minute

	// imageURLSizeMarker is used by thumbURL
	imageURLSizeMarker    = "__w-"
	imageURLSizeMarkerLen = len(imageURLSizeMarker)

	gcsReadOnlyScope = "https://www.googleapis.com/auth/devstorage.read_only"
)

var (
	// session IDs to compare timeoutSoon to.
	soonSessionIDs = []string{keynoteID}
	// session IDs to compare timeoutSurvey to.
	surveySessionIDs = []string{keynoteID}
	// reChannleID parses session description text.
	reChannelID = regexp.MustCompile("(?i)channel\\s+(\\d)")
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
	IsFeatured bool      `json:"isFeatured"`
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

	// Update is used only api/user/updates
	Update string `json:"update,omitempty"`
}

func (s *eventSession) hasLiveChannel() bool {
	return s.IsLive && s.YouTube != "" &&
		!strings.HasPrefix(s.YouTube, "http://") && !strings.HasPrefix(s.YouTube, "https://") &&
		reChannelID.MatchString(s.Desc)
}

func (s *eventSession) liveChannelID() int {
	var n int
	m := reChannelID.FindStringSubmatch(s.Desc)
	if m != nil {
		n, _ = strconv.Atoi(m[1])
	}
	return n
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
		if compareSessions(as, bs) {
			dc.Sessions[id] = bs
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

// compareSessions compares eventSession fields of a to those of b.
// It returns true and modifies b.Update field if the two args have different field values.
//
// While most of the fields are compared with reflect.DeepEqual,
// IsLive and YouTube fields are treated separately. They are compared
// only when b.EndTime is in the past w.r.t. current system time.
//
// Side effect: a.Speakers and a.Tags will be assigned nil if their len() == 0.
func compareSessions(a, b *eventSession) bool {
	// save originals
	ob := *b
	defer func() {
		// restore all b's field from ob except .Update
		up := b.Update
		*b = ob
		b.Update = up
	}()

	// normalize slices
	if len(a.Speakers) == 0 {
		a.Speakers = nil
	}
	if len(a.Tags) == 0 {
		a.Tags = nil
	}
	if len(b.Speakers) == 0 {
		b.Speakers = nil
	}
	if len(b.Tags) == 0 {
		b.Tags = nil
	}

	now := time.Now()
	// don't care about start/end time for past sessions
	if now.After(a.EndTime) && now.After(b.EndTime) {
		b.StartTime = a.StartTime
		b.EndTime = a.EndTime
	}

	// compare for 'details' update
	b.IsFeatured = a.IsFeatured
	b.IsLive = a.IsLive
	b.YouTube = a.YouTube
	if !reflect.DeepEqual(a, b) {
		b.Update = updateDetails
		return true
	}
	// compare for 'video' updates, but only for past sessions
	if now.Before(b.EndTime) || ob.IsLive == a.IsLive && ob.YouTube == a.YouTube {
		return false
	}
	// either IsLive or YouTube is changed, or both
	if !ob.IsLive && ob.YouTube != "" {
		b.Update = updateVideo
		return true
	}

	return false
}

// upcomingSessions returns a subset of item copies which have their StartTime field
// close to timeoutStart or timeoutSoon.
// It also sets Update field of the returned elements to updateStart or updateSoon respectively.
// Original items are not modified.
func upcomingSessions(now time.Time, items []*eventSession) []*eventSession {
	sort.Strings(soonSessionIDs)
	res := make([]*eventSession, 0)
	for _, s := range items {
		t := s.StartTime.Sub(now)
		i := sort.SearchStrings(soonSessionIDs, s.Id)
		doSoon := i < len(soonSessionIDs) && soonSessionIDs[i] == s.Id
		var update string
		switch {
		default:
			continue
		case t > 0 && t < timeoutStart:
			update = updateStart
		case doSoon && t > 0 && t < timeoutSoon:
			update = updateSoon
		}
		scopy := *s
		scopy.Update = update
		res = append(res, &scopy)
	}
	return res
}

// upcomingSurveys returns a subset of item copies which are ready to receive user feedback.
// It also sets Update field of the returned elements to updateSurvey.
// Original items are not modified.
func upcomingSurveys(now time.Time, items []*eventSession) []*eventSession {
	sort.Strings(soonSessionIDs)
	res := make([]*eventSession, 0)
	for _, s := range items {
		t := s.StartTime.Sub(now)
		i := sort.SearchStrings(surveySessionIDs, s.Id)
		doSurvey := i < len(surveySessionIDs) && surveySessionIDs[i] == s.Id
		if !doSurvey || t > 0 || t > -timeoutSurvey {
			continue
		}
		scopy := *s
		scopy.Update = updateSurvey
		res = append(res, &scopy)
	}
	return res
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

// scheduleLiveIDs returns a slice of all youtubeUrl field values where isLivestream == true
// for the current day or event first day if start date is in the future comparing to now.
// Keynote element is always first, even if its youtubeUrl value is empty.
func scheduleLiveIDs(c context.Context, now time.Time) ([]string, error) {
	d, err := getLatestEventData(c, nil)
	if err != nil {
		return nil, err
	}
	if d.Sessions == nil {
		return nil, nil
	}

	now = now.In(config.Schedule.Location)
	start := config.Schedule.Start.In(config.Schedule.Location)
	theday := start.YearDay()
	if now.After(start) {
		theday = now.YearDay()
	}

	live := sortedChannelSessions(make([]*eventSession, 0, len(d.Sessions)/2))
	for id, s := range d.Sessions {
		sday := s.StartTime.In(config.Schedule.Location).YearDay()
		if id == keynoteID || !s.hasLiveChannel() || sday != theday {
			continue
		}
		live = append(live, s)
	}
	sort.Sort(live)

	keyURL := ""
	if s, ok := d.Sessions[keynoteID]; ok && s.IsLive {
		keyURL = s.YouTube
	}

	res := []string{keyURL}
	for _, s := range live {
		res = append(res, s.YouTube)
	}
	return unique(res), nil
}

// unique removes duplicates from slice.
// Original arg is not modified. Elements order is preserved.
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

// thumbURL converts turl to a smaller image URL.
// turl must include specially formatted path part which starts with "__w-",
// followed by available sizes, e.g. "__w-200-400-600-800-1000".
// If turl doesn't have the "__w-" format, the returned value is turl.
func thumbURL(turl string) string {
	i := strings.Index(turl, imageURLSizeMarker)
	if i < 0 || len(turl) < i+imageURLSizeMarkerLen+1 {
		return turl
	}
	j := strings.IndexRune(turl[i+imageURLSizeMarkerLen+1:], '-')
	if j < 0 {
		return turl
	}
	j += i + imageURLSizeMarkerLen + 1
	k := strings.Index(turl[j:], "/")
	if k < 0 {
		return turl
	}
	k += j
	return turl[:i] + "w" + turl[i+imageURLSizeMarkerLen:j] + turl[k:]
}

// sortedSessionsList implements sort.Sort ordering items by:
//   - start time
//   - end time
//   - title
type sortedSessionsList []*eventSession

func (l sortedSessionsList) Len() int {
	return len(l)
}

func (l sortedSessionsList) Swap(i, j int) {
	l[i], l[j] = l[j], l[i]
}

func (l sortedSessionsList) Less(i, j int) bool {
	a, b := l[i], l[j]
	if a.StartTime.Before(b.StartTime) {
		return true
	}
	if a.StartTime.After(b.StartTime) {
		return false
	}
	if a.EndTime.Before(b.EndTime) {
		return true
	}
	if a.EndTime.After(b.EndTime) {
		return false
	}
	return a.Title < b.Title
}

// sortedSessionsList implements sort.Sort ordering items by title
type sortedVideosList []*eventVideo

func (l sortedVideosList) Len() int {
	return len(l)
}

func (l sortedVideosList) Swap(i, j int) {
	l[i], l[j] = l[j], l[i]
}

func (l sortedVideosList) Less(i, j int) bool {
	return l[i].Title < l[j].Title
}

// sortedChannelSessions implements sort.Sort ordering by "Channel N"
// in the session descriptions.
type sortedChannelSessions []*eventSession

func (s sortedChannelSessions) Len() int {
	return len(s)
}

func (s sortedChannelSessions) Swap(i, j int) {
	s[i], s[j] = s[j], s[i]
}

func (s sortedChannelSessions) Less(i, j int) bool {
	return s[i].liveChannelID() < s[j].liveChannelID()
}
