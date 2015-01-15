package main

import (
	"encoding/xml"
	"fmt"
	"io/ioutil"
	"log"
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

// ioExtEntries returns a slice of extEntry items,
// fetching them from ioExtSheet Google Spreadsheet using List Feed.
// Cache can be invalidated by providing refresh = true.
func ioExtEntries(c context.Context, refresh bool) ([]*extEntry, error) {
	var (
		data []byte
		err  error
	)
	if !refresh {
		data, err = cache.get(c, cacheKeyIOExtended)
	}

	if err != nil || data == nil {
		data, err = fetchSheetListFeed(c, ioExtSheet)
		if err != nil {
			return nil, err
		}
		if err := cache.set(c, cacheKeyIOExtended, data, 2*time.Hour); err != nil {
			log.Printf("cache.put(%q): %v", cacheKeyIOExtended, err)
		}
	}

	feed := &extFeed{}
	if err := xml.Unmarshal(data, feed); err != nil {
		return nil, err
	}
	return feed.Entries, nil
}

// fetchSheetListFeed retrieves a list feed of the spreadsheet.
// sheet must be in format "sheet_key/worksheet_id"
func fetchSheetListFeed(c context.Context, sheet string) ([]byte, error) {
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
	return ioutil.ReadAll(resp.Body)
}
