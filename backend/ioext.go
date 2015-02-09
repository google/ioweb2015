package main

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"log"
	"math"
	"time"

	"golang.org/x/net/context"
)

const (
	// scopeSpreadsheetFeeds is OAuth Google Spreadsheet Feeds scope
	scopeSpreadsheetFeeds = "https://spreadsheets.google.com/feeds"
	// sheetListFeed is the GData Spreadsheet List Feed URL format v3.0
	sheetListFeed = "https://spreadsheets.google.com/feeds/list/%s/private/full"
	// ioExtSheet is a sheet_key/worksheet_id of I/O extended Google Sheet.
	ioExtSheet = "1C5_yRUvHCwZEWiNZl1fjdM9-t9HFw0MpNDRyIseji5I/od6"
	// cacheKeyIOExtended is a cache key for the feed entries
	cacheKeyIOExtended = "ioExtXMLFeed"
)

// extFeed is the root element of a Google Sheet feed.
type extFeed struct {
	XMLName xml.Name    `xml:"feed"`
	Entries []*extEntry `xml:"entry"`
}

// extEntry represents a single entiry of a Google Sheet form
// for I/O extended registration.
type extEntry struct {
	Name string  `json:"name" xml:"http://schemas.google.com/spreadsheets/2006/extended eventname"`
	Link string  `json:"link" xml:"http://schemas.google.com/spreadsheets/2006/extended googleeventlink"`
	Lat  float64 `json:"lat" xml:"http://schemas.google.com/spreadsheets/2006/extended latitude"`
	Lng  float64 `json:"lng" xml:"http://schemas.google.com/spreadsheets/2006/extended longitude"`
}

// ioExtEntries fetches I/O Extended items either from cache or a spreadsheet.
// Cache can be invalidated by providing refresh = true.
func ioExtEntries(c context.Context, refresh bool) ([]*extEntry, error) {
	if !refresh {
		entries, err := ioExtEntriesFromCache(c, cacheKeyIOExtended)
		if err == nil {
			return entries, nil
		}
	}

	entries, err := fetchIOExtEntries(c, ioExtSheet)
	if err != nil {
		return nil, err
	}

	data, err := json.Marshal(entries)
	if err != nil {
		log.Println(err)
	} else if err := cache.set(c, cacheKeyIOExtended, data, 2*time.Hour); err != nil {
		log.Printf("cache.put(%q): %v", cacheKeyIOExtended, err)
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
// sheet argument must be in "sheet_key/worksheet_id" format.
func fetchIOExtEntries(c context.Context, sheet string) ([]*extEntry, error) {
	hc, err := serviceAccountClient(c, scopeSpreadsheetFeeds)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf(sheetListFeed, sheet)
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
		if e.Name == "" || e.Link == "" || (math.Abs(e.Lat) < 1e-6 && math.Abs(e.Lng) < 1e-6) {
			log.Printf("fetchIOExtEntries: skipping %#v", e)
			continue
		}
		entries = append(entries, e)
	}
	return entries, nil
}
