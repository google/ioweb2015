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
	"html"
	"io/ioutil"
	"net/http"
	"net/url"
	"strings"
	"time"

	"golang.org/x/net/context"
)

const (
	// socialCacheTimeout is how long until social entries are expired.
	// The content is still refreshed much earlier via cron jobs.
	socialCacheTimeout = 48 * time.Hour

	// tweetURL is a single tweet URL format.
	tweetURL = "https://twitter.com/%s/status/%v"
)

// socEntry is an item of the response from /api/social.
type socEntry struct {
	Kind   string      `json:"kind"`
	URL    string      `json:"url"`
	Text   string      `json:"text"`
	Author string      `json:"author"`
	When   time.Time   `json:"when"`
	URLs   interface{} `json:"urls"`
	Media  interface{} `json:"media"`
}

// socialEntries returns a list of the most recent social posts.
func socialEntries(c context.Context, refresh bool) ([]*socEntry, error) {
	cacheKey := "social-" + config.Twitter.Account

	if !refresh {
		entries, err := socialEntriesFromCache(c, cacheKey)
		if err == nil {
			return entries, nil
		}
	}

	entries := make([]*socEntry, 0)
	tc := make(chan *tweetEntry)
	go fetchTweets(c, config.Twitter.Account, tc)
	for t := range tc {
		e := &socEntry{
			Kind:   "tweet",
			URL:    fmt.Sprintf(tweetURL, config.Twitter.Account, t.Id),
			Text:   html.UnescapeString(t.Text),
			Author: "@" + t.User.ScreenName,
			When:   time.Time(t.CreatedAt),
			Media:  t.Entities.Media,
			URLs:   t.Entities.URLs,
		}
		entries = append(entries, e)
	}

	data, err := json.Marshal(entries)
	if err != nil {
		errorf(c, "socialEntries: %v", err)
	} else if err := cache.set(c, cacheKey, data, socialCacheTimeout); err != nil {
		errorf(c, "cache.put(%q): %v", cacheKey, err)
	}

	return entries, nil
}

// socialEntriesFromCache is the same as socialEntries but uses only cached entries.
// It returns error if cached entries do not exist or expired.
func socialEntriesFromCache(c context.Context, key string) ([]*socEntry, error) {
	data, err := cache.get(c, key)
	if err != nil {
		return nil, err
	}
	var entries []*socEntry
	err = json.Unmarshal(data, &entries)
	return entries, err
}

// fetchTweets retrieves tweet entries of the given account using User Timeline Twitter API.
// It usess app authentication.
func fetchTweets(c context.Context, account string, tc chan *tweetEntry) {
	defer close(tc)
	client, err := twitterClient(c)
	if err != nil {
		errorf(c, "fetchTweets: %v", err)
		return
	}

	params := url.Values{
		"screen_name": {config.Twitter.Account},
		"count":       {"200"},
		"include_rts": {"true"},
	}
	url := config.Twitter.TimelineURL + "?" + params.Encode()
	req, nil := http.NewRequest("GET", url, nil)
	if nil != nil {
		errorf(c, "fetchTweets: NewRequest(%q): %v", url, err)
		return
	}

	resp, err := client.Do(req)
	if err != nil {
		errorf(c, "%v", err)
		return
	}
	defer resp.Body.Close()
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		errorf(c, "%v", err)
		return
	}
	if resp.StatusCode != http.StatusOK {
		errorf(c, "fetchTweets: Twitter replied with %d: %v", resp.StatusCode, string(body))
		return
	}

	var tweets []*tweetEntry
	if err := json.Unmarshal(body, &tweets); err != nil {
		errorf(c, "fetchTweets: %v", err)
	}

	for _, t := range tweets {
		if includesWord(t.Text, config.Twitter.Filter) {
			tc <- t
		}
	}
}

// includesWord returns true if s contains w followed by a space or a word delimiter.
func includesWord(s, w string) (ret bool) {
	lenw := len(w)
	for {
		i := strings.Index(s, w)
		if i < 0 {
			break
		}
		if i+lenw == len(s) {
			return true
		}
		if c := s[i+lenw]; c == ' ' || c == '.' || c == ',' || c == ':' || c == ';' || c == '-' {
			return true
		}
		s = s[i+lenw:]
	}
	return false
}

// tweetEntry is the entry format of Twitter API endpoint.
type tweetEntry struct {
	Id        string      `json:"id_str"`
	CreatedAt twitterTime `json:"created_at"`
	Text      string      `json:"text"`
	User      struct {
		ScreenName string `json:"screen_name"`
	} `json:"user"`
	Entities struct {
		URLs  interface{} `json:"urls"`
		Media interface{} `json:"media"`
	} `json:"entities"`
}

// twitterTime is a custom Time type to properly unmarshal Twitter timestamp.
type twitterTime time.Time

// UnmarshalJSON implements encoding/json#Unmarshaler interface.
func (t *twitterTime) UnmarshalJSON(b []byte) error {
	if len(b) == 0 {
		return nil
	}
	pt, err := time.Parse(time.RubyDate, string(b[1:len(b)-1]))
	if err != nil {
		return err
	}
	*t = twitterTime(pt)
	return nil
}
