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
	"net/http"
	"net/http/httptest"
	"testing"

	"golang.org/x/net/context"
)

const testXmlFeed = `
<?xml version='1.0' encoding='UTF-8'?>
<feed xmlns='http://www.w3.org/2005/Atom' xmlns:gsx='http://schemas.google.com/spreadsheets/2006/extended'>
	<entry>
		<gsx:eventname>Google I/O extended Nyeri</gsx:eventname>
		<gsx:googleeventlink>https://plus.google.com/events/event-1</gsx:googleeventlink>
    <gsx:latitude>n/a</gsx:latitude>
		<gsx:longitude></gsx:longitude>
	</entry>
	<entry>
		<gsx:eventname>I/O Extended Madrid</gsx:eventname>
		<gsx:googleeventlink>https://plus.google.com/events/event-2</gsx:googleeventlink>
		<gsx:latitude>40.401982</gsx:latitude>
		<gsx:longitude>-3.608424</gsx:longitude>
	</entry>
</feed>
`

func TextFetchIOExtEntries(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(testXmlFeed))
	}))
	defer ts.Close()

	items, err := fetchIOExtEntries(context.Background(), ts.URL)
	if err != nil {
		t.Fatalf("fetchIOExtEntries(%q): %v", ts.URL, err)
	}
	if len(items) != 1 {
		t.Fatalf("len(items) = %d; want 1", len(items))
	}
	entry := items[0]
	if v := "I/O Extended Madrid"; entry.Name != v {
		t.Errorf("entry.Name = %q; want %q", entry.Name, v)
	}
	if v := "https://plus.google.com/events/event-2"; entry.Link != v {
		t.Errorf("entry.Link = %q; want %q", entry.Link, v)
	}
	if v := 40.401982; entry.Lat != v {
		t.Errorf("entry.Lat = %f; want %f", entry.Lat, v)
	}
	if v := -3.608424; entry.Lng != v {
		t.Errorf("entry.Lng = %f; want %f", entry.Lng, v)
	}
}
