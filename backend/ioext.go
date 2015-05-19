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
	"encoding/xml"
	"strconv"
	"time"

	"golang.org/x/net/context"
)

const (
	spreadsheetAuthScope = "https://spreadsheets.google.com/feeds"

	// ioextCacheTimeout is how long until cached extFeed entries are expired.
	// The content is still refreshed much earlier via cron jobs.
	ioextCacheTimeout = 48 * time.Hour
)

// extFeed is the root element of a Google Sheet feed.
type extFeed struct {
	XMLName xml.Name    `xml:"feed"`
	Entries []*extEntry `xml:"entry"`
}

// extEntry represents a single entiry of a Google Sheet form
// for I/O extended registration.
type extEntry struct {
	Name   string  `json:"name" xml:"http://schemas.google.com/spreadsheets/2006/extended eventname"`
	Link   string  `json:"link" xml:"http://schemas.google.com/spreadsheets/2006/extended googleeventlink"`
	City   string  `json:"city" xml:"http://schemas.google.com/spreadsheets/2006/extended city"`
	Lat    float64 `json:"lat"`
	Lng    float64 `json:"lng"`
	XMLLat string  `json:"-" xml:"http://schemas.google.com/spreadsheets/2006/extended latitude"`
	XMLLng string  `json:"-" xml:"http://schemas.google.com/spreadsheets/2006/extended longitude"`
}

// ioExtEntries fetches I/O Extended items either from cache or a spreadsheet.
// Cache can be invalidated by providing refresh = true.
func ioExtEntries(c context.Context, refresh bool) ([]*extEntry, error) {
	feedURL := config.IoExtFeedURL
	if !refresh {
		entries, err := ioExtEntriesFromCache(c, feedURL)
		if err == nil {
			return entries, nil
		}
	}

	entries, err := fetchIOExtEntries(c, feedURL)
	if err != nil {
		return nil, err
	}

	data, err := json.Marshal(entries)
	if err != nil {
		errorf(c, "ioExtEntries: %v", err)
	} else if err := cache.set(c, feedURL, data, ioextCacheTimeout); err != nil {
		errorf(c, "ioExtEntries: cache.put(%q): %v", feedURL, err)
	}

	return entries, nil
}

// ioExtEntriesFromCache is the same as ioExtEntries but uses only cached items.
// It returns error if cached entries do not exist or expired.
func ioExtEntriesFromCache(c context.Context, key string) ([]*extEntry, error) {
	data, err := cache.get(c, key)
	if err != nil {
		return nil, err
	}
	var entries []*extEntry
	err = json.Unmarshal(data, &entries)
	return entries, err
}

// ioExtEntriesFromCache is the same as ioExtEntries but uses only Spreadsheet API, no cache.
// url arg is a Spreadsheet List Feed url.
func fetchIOExtEntries(c context.Context, url string) ([]*extEntry, error) {
	hc, err := serviceAccountClient(c, spreadsheetAuthScope)
	if err != nil {
		return nil, err
	}

	resp, err := hc.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	feed := &extFeed{}
	if err := xml.NewDecoder(resp.Body).Decode(feed); err != nil {
		return nil, err
	}

	entries := make([]*extEntry, 0, len(feed.Entries))
	for _, e := range feed.Entries {
		lat, err := strconv.ParseFloat(e.XMLLat, 64)
		if err != nil {
			errorf(c, "fetchIOExtEntries: strconv(XMLLat): %v; item: %#v", err, e)
			continue
		}
		lng, err := strconv.ParseFloat(e.XMLLng, 64)
		if err != nil {
			errorf(c, "fetchIOExtEntries: strconv(XMLLng): %v; item: %#v", err, e)
			continue
		}
		if e.Name == "" || e.Link == "" {
			logf(c, "fetchIOExtEntries: skipping %#v", e)
			continue
		}
		e.Lat, e.Lng = lat, lng
		entries = append(entries, e)
	}
	return entries, nil
}
