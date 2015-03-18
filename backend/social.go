package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"strings"
	"time"

	"golang.org/x/net/context"
)

const (
	// socialCacheTimeout is how long until social entries are expired.
	socialCacheTimeout = 10 * time.Minute

	// tweetURL is a single tweet URL format.
	tweetURL = "https://twitter.com/%s/status/%v"
)

// socEntry is an item of the response from /api/social.
type socEntry struct {
	Kind   string    `json:"kind"`
	URL    string    `json:"url"`
	Text   string    `json:"text"`
	Author string    `json:"author"`
	When   time.Time `json:"when"`
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
			Text:   t.Text,
			Author: "@" + t.User.ScreenName,
			When:   time.Time(t.CreatedAt),
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

	lenFilter := len(config.Twitter.Filter)
	for _, t := range tweets {
		i := strings.Index(t.Text, config.Twitter.Filter)
		if i < 0 {
			continue
		}
		if i+lenFilter == len(t.Text)-1 || t.Text[i+lenFilter] == ' ' {
			tc <- t
		}
	}
}

// tweetEntry is the entry format of Twitter API endpoint.
type tweetEntry struct {
	Id        string      `json:"id_str"`
	CreatedAt twitterTime `json:"created_at"`
	Text      string      `json:"text"`
	User      struct {
		ScreenName string `json:"screen_name"`
	} `json:"user"`
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
