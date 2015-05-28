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
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
	"sort"
	"strings"
	"testing"
	"time"
)

func TestServeIOExtEntriesStub(t *testing.T) {
	defer resetTestState(t)
	r := newTestRequest(t, "GET", "/api/v1/extended", nil)
	w := httptest.NewRecorder()
	serveIOExtEntries(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("GET %s: %d; want %d", r.URL.String(), w.Code, http.StatusOK)
	}
	ctype := "application/json;charset=utf-8"
	if w.Header().Get("Content-Type") != ctype {
		t.Errorf("Content-Type: %q; want %q", w.Header().Get("Content-Type"), ctype)
	}
}

func TestServeSocialStub(t *testing.T) {
	defer resetTestState(t)
	r := newTestRequest(t, "GET", "/api/v1/social", nil)
	w := httptest.NewRecorder()
	serveSocial(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("w.Code = %d; want %d", w.Code, http.StatusOK)
	}
	ctype := "application/json;charset=utf-8"
	if v := w.Header().Get("Content-Type"); v != ctype {
		t.Errorf("Content-Type: %q; want %q", v, ctype)
	}
}

func TestServeScheduleStub(t *testing.T) {
	defer resetTestState(t)
	defer preserveConfig()
	config.Env = "dev"

	r := newTestRequest(t, "GET", "/api/v1/schedule", nil)
	w := httptest.NewRecorder()
	serveSchedule(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("w.Code = %d; want %d", w.Code, http.StatusOK)
	}
	etag := w.Header().Get("etag")
	if etag == "" || etag == `""` {
		t.Fatalf("etag = %q; want non-empty", etag)
	}

	r = newTestRequest(t, "GET", "/api/v1/schedule", nil)
	r.Header.Set("if-none-match", etag)
	w = httptest.NewRecorder()
	serveSchedule(w, r)

	if w.Code != http.StatusNotModified {
		t.Errorf("w.Code = %d; want %d", w.Code, http.StatusNotModified)
	}
}

func TestServeSchedule(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()
	config.Env = "prod"
	r := newTestRequest(t, "GET", "/api/v1/schedule", nil)
	c := newContext(r)

	checkRes := func(n int, w *httptest.ResponseRecorder, code int, hasEtag bool) string {
		if w.Code != code {
			t.Errorf("%d: w.Code = %d; want %d", n, w.Code, code)
		}
		etag := w.Header().Get("etag")
		if hasEtag && (etag == "" || etag == `""`) {
			t.Errorf("%d: etag = %q; want non-empty", n, etag)
		}
		if !hasEtag && etag != `""` {
			t.Errorf("%d: etag = %q; want %q", n, etag, `""`)
		}
		return etag
	}

	// 0: cache miss; 1: cache hit
	for i := 0; i < 2; i += 1 {
		// no etag, unless cached
		w := httptest.NewRecorder()
		serveSchedule(w, r)
		checkRes(1, w, http.StatusOK, i > 0)

		// first etag
		if err := storeEventData(c, &eventData{modified: time.Now()}); err != nil {
			t.Fatal(err)
		}
		w = httptest.NewRecorder()
		serveSchedule(w, r)
		etag := checkRes(2, w, http.StatusOK, true)

		r.Header.Set("if-none-match", etag)
		w = httptest.NewRecorder()
		serveSchedule(w, r)
		checkRes(3, w, http.StatusNotModified, true)

		// new etag
		if err := storeEventData(c, &eventData{modified: time.Now()}); err != nil {
			t.Fatal(err)
		}
		w = httptest.NewRecorder()
		serveSchedule(w, r)
		etag = checkRes(4, w, http.StatusOK, true)

		w = httptest.NewRecorder()
		r.Header.Set("if-none-match", etag)
		serveSchedule(w, r)
		checkRes(5, w, http.StatusNotModified, true)

		// star etag
		w = httptest.NewRecorder()
		r.Header.Set("if-none-match", "*")
		serveSchedule(w, r)
		lastEtag := checkRes(5, w, http.StatusOK, true)
		if lastEtag != etag {
			t.Errorf("lastEtag = %q; want %q", lastEtag, etag)
		}
	}
}

func TestServeTemplate(t *testing.T) {
	defer resetTestState(t)
	defer preserveConfig()()
	const ctype = "text/html;charset=utf-8"
	config.Prefix = "/root"

	table := []struct{ path, slug, canonical string }{
		{"/", "home", "http://example.org/root/"},
		{"/home?experiment", "home", "http://example.org/root/"},
		{"/about", "about", "http://example.org/root/about"},
		{"/about?experiment", "about", "http://example.org/root/about"},
		{"/about?some=param", "about", "http://example.org/root/about"},
		{"/schedule", "schedule", "http://example.org/root/schedule"},
		{"/schedule?sid=not-there", "schedule", "http://example.org/root/schedule"},
		{"/onsite", "onsite", "http://example.org/root/onsite"},
		{"/offsite", "offsite", "http://example.org/root/offsite"},
		{"/registration", "registration", "http://example.org/root/registration"},
		{"/faq", "faq", "http://example.org/root/faq"},
		{"/form", "form", "http://example.org/root/form"},
	}
	for i, test := range table {
		r := newTestRequest(t, "GET", test.path, nil)
		r.Host = "example.org"
		w := httptest.NewRecorder()
		serveTemplate(w, r)

		if w.Code != http.StatusOK {
			t.Errorf("%d: GET %s = %d; want %d", i, test.path, w.Code, http.StatusOK)
			continue
		}
		if v := w.Header().Get("Content-Type"); v != ctype {
			t.Errorf("%d: Content-Type: %q; want %q", i, v, ctype)
		}
		if w.Header().Get("Cache-Control") == "" {
			t.Errorf("%d: want cache-control header", i)
		}

		body := string(w.Body.String())

		tag := `<body id="page-` + test.slug + `"`
		if !strings.Contains(body, tag) {
			t.Errorf("%d: %s does not contain %s", i, body, tag)
		}
		tag = `<link rel="canonical" href="` + test.canonical + `"`
		if !strings.Contains(body, tag) {
			t.Errorf("%d: %s does not contain %s", i, body, tag)
		}
	}
}

func TestServeTemplateRedirect(t *testing.T) {
	defer resetTestState(t)
	table := []struct{ start, redirect string }{
		{"/about/", "/about"},
		{"/one/two/", "/one/two"},
	}
	for i, test := range table {
		r := newTestRequest(t, "GET", test.start, nil)
		w := httptest.NewRecorder()
		serveTemplate(w, r)

		if w.Code != http.StatusFound {
			t.Fatalf("%d: GET %s: %d; want %d", i, test.start, w.Code, http.StatusFound)
		}
		redirect := config.Prefix + test.redirect
		if loc := w.Header().Get("Location"); loc != redirect {
			t.Errorf("%d: Location: %q; want %q", i, loc, redirect)
		}
	}
}

func TestServeTemplate404(t *testing.T) {
	defer resetTestState(t)
	r := newTestRequest(t, "GET", "/a-thing-that-is-not-there", nil)
	w := httptest.NewRecorder()
	serveTemplate(w, r)
	if w.Code != http.StatusNotFound {
		t.Errorf("GET %s: %d; want %d", r.URL.String(), w.Code, http.StatusNotFound)
	}
	const ctype = "text/html;charset=utf-8"
	if v := w.Header().Get("Content-Type"); v != ctype {
		t.Errorf("Content-Type: %q; want %q", v, ctype)
	}
	if v := w.Header().Get("Cache-Control"); v != "" {
		t.Errorf("don't want Cache-Control: %q", v)
	}
}

func TestServeSessionTemplate(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)

	c := newContext(newTestRequest(t, "GET", "/dummmy", nil))
	if err := storeEventData(c, &eventData{Sessions: map[string]*eventSession{
		"123": &eventSession{
			Title: "Session",
			Desc:  "desc",
			Photo: "http://image.jpg",
		},
	}}); err != nil {
		t.Fatal(err)
	}

	table := []*struct{ p, title, desc, image string }{
		{"/schedule", "Schedule", descDefault, config.Prefix + "/" + ogImageDefault},
		{"/schedule?sid=not-there", "Schedule", descDefault, config.Prefix + "/" + ogImageDefault},
		{"/schedule?sid=123", "Session - Google I/O Schedule", "desc", "http://image.jpg"},
	}

	for i, test := range table {
		lookup := []string{
			`<title>` + test.title + `</title>`,
			`<meta itemprop="name" content="` + test.title + `">`,
			`<meta itemprop="description" content="` + test.desc + `">`,
			`<meta itemprop="image" content="` + test.image + `">`,
			`<meta name="twitter:title" content="` + test.title + `">`,
			`<meta name="twitter:description" content="` + test.desc + `">`,
			`<meta name="twitter:image:src" content="` + test.image + `">`,
			`<meta property="og:title" content="` + test.title + `">`,
			`<meta property="og:description" content="` + test.desc + `">`,
			`<meta property="og:image" content="` + test.image + `">`,
		}
		r := newTestRequest(t, "GET", test.p, nil)
		w := httptest.NewRecorder()
		serveTemplate(w, r)
		if w.Code != http.StatusOK {
			t.Errorf("%d: w.Code = %d; want 200", i, w.Code)
		}
		miss := 0
		for _, s := range lookup {
			if !strings.Contains(w.Body.String(), s) {
				t.Errorf("%d: missing %s", i, s)
				miss += 1
			}
		}
		if miss > 0 {
			t.Errorf("%d: %d meta tags are missing in layout:\n%s", i, miss, w.Body.String())
		}
	}
}

func TestServeEmbed(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	now := time.Now().Round(time.Second).UTC()
	config.Schedule.Start = now
	config.Schedule.Location = time.UTC
	config.Prefix = "/pref"

	r := newTestRequest(t, "GET", "/embed", nil)
	r.Host = "example.org"
	c := newContext(r)

	if err := storeEventData(c, &eventData{Sessions: map[string]*eventSession{
		"live": &eventSession{
			StartTime: now,
			IsLive:    true,
			YouTube:   "live",
			Desc:      "Channel 1",
		},
		"recorded": &eventSession{
			StartTime: now,
			IsLive:    false,
			YouTube:   "http://recorded",
			Desc:      "Channel 1",
		},
		keynoteID: &eventSession{
			StartTime: now,
			IsLive:    true,
			YouTube:   "keynote",
		},
		"same-live": &eventSession{
			StartTime: now,
			IsLive:    true,
			YouTube:   "live",
			Desc:      "Channel 1",
		},
	}}); err != nil {
		t.Fatal(err)
	}

	w := httptest.NewRecorder()
	serveTemplate(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("w.Code = %d; want 200\nResponse: %s", w.Code, w.Body.String())
	}
	lookup := []string{
		`<link rel="canonical" href="http://example.org/pref/embed">`,
		`startDate="` + now.Format(time.RFC3339) + `"`,
		`videoIds='["keynote","live"]'`,
	}
	err := false
	for _, v := range lookup {
		if !strings.Contains(w.Body.String(), v) {
			err = true
			t.Errorf("does not contain %s", v)
		}
	}
	if err {
		t.Logf("response: %s", w.Body.String())
	}
}

func TestServeSitemap(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	c := newContext(newTestRequest(t, "GET", "/dummmy", nil))
	if err := storeEventData(c, &eventData{
		modified: time.Now(),
		Sessions: map[string]*eventSession{
			"123": &eventSession{Id: "123"},
		},
	}); err != nil {
		t.Fatal(err)
	}

	config.Prefix = "/pref"
	r := newTestRequest(t, "GET", "/sitemap.xml", nil)
	r.Host = "example.org"
	r.TLS = &tls.ConnectionState{}
	w := httptest.NewRecorder()
	serveSitemap(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("w.Code = %d; want 200", w.Code)
	}

	lookup := []struct {
		line  string
		found bool
	}{
		{`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`, true},
		{`<loc>https://example.org/pref/</loc>`, true},
		{`<loc>https://example.org/pref/about</loc>`, true},
		{`<loc>https://example.org/pref/schedule</loc>`, true},
		{`<loc>https://example.org/pref/schedule?sid=123</loc>`, true},
		{`<loc>https://example.org/pref/home`, false},
		{`<loc>https://example.org/pref/embed`, false},
		{`<loc>https://example.org/pref/upgrade`, false},
		{`<loc>https://example.org/pref/admin`, false},
		{`<loc>https://example.org/pref/debug`, false},
		{`<loc>https://example.org/pref/error_`, false},
	}
	err := false
	for _, l := range lookup {
		found := strings.Contains(w.Body.String(), l.line)
		if !found && l.found {
			err = true
			t.Errorf("does not contain %s", l.line)
		}
		if found && !l.found {
			err = true
			t.Errorf("contain %s", l.line)
		}
	}
	if err {
		t.Errorf("response:\n%s", w.Body.String())
	}
}

func TestServeManifest(t *testing.T) {
	defer preserveConfig()()
	config.Google.GCM.Sender = "sender-123"

	r := newTestRequest(t, "GET", "/manifest.json", nil)
	w := httptest.NewRecorder()
	serveManifest(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("w.Code = %d; want 200", w.Code)
	}
	res := map[string]interface{}{}
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	if v, ok := res["gcm_sender_id"].(string); !ok || v != "sender-123" {
		t.Errorf("gcm_sender_id = %v; want 'sender-123'", res["gcm_sender_id"])
	}
}

func TestHandleAuth(t *testing.T) {
	defer resetTestState(t)
	defer preserveConfig()()
	const code = "fake-auth-code"

	table := []struct {
		token            string
		doExchange       bool
		exchangeRespCode int
		success          bool
	}{
		{"valid", true, http.StatusOK, true},
		{"valid", true, http.StatusBadRequest, false},
		{"", false, http.StatusOK, false},
		{testIDToken, true, http.StatusOK, true},
		{testIDToken, true, http.StatusBadRequest, false},
	}

	for i, test := range table {
		resetTestState(t)

		done := make(chan struct{}, 1)
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if v := r.FormValue("code"); v != code {
				t.Errorf("code = %q; want %q", v, code)
			}
			if v := r.FormValue("client_id"); v != testClientID {
				t.Errorf("client_id = %q; want %q", v, testClientID)
			}
			if v := r.FormValue("client_secret"); v != testClientSecret {
				t.Errorf("client_secret = %q; want %q", v, testClientSecret)
			}
			if v := r.FormValue("redirect_uri"); v != "postmessage" {
				t.Errorf("redirect_uri = %q; want postmessage", v)
			}
			if v := r.FormValue("grant_type"); v != "authorization_code" {
				t.Errorf("grant_type = %q; want authorization_code", v)
			}

			w.WriteHeader(test.exchangeRespCode)
			w.Header().Set("Content-Type", "application/json")
			fmt.Fprintf(w, `{
				"access_token": "new-access-token",
				"refresh_token": "new-refresh-token",
				"id_token": %q,
				"expires_in": 3600
			}`, testIDToken)

			done <- struct{}{}
		}))
		defer ts.Close()
		config.Google.TokenURL = ts.URL

		p := strings.NewReader(`{"code": "` + code + `"}`)
		r := newTestRequest(t, "POST", "/api/v1/auth", p)
		r.Header.Set("Authorization", "Bearer "+test.token)
		w := httptest.NewRecorder()
		c := newContext(r)

		cache.flush(c)
		handleAuth(w, r)

		if test.success && w.Code != http.StatusOK {
			t.Errorf("%d: code = %d; want 200\nbody: %s", i, w.Code, w.Body.String())
		} else if !test.success && w.Code == http.StatusOK {
			t.Errorf("%d: code = 200; want > 399\nbody: %s", i, w.Body)
		}

		select {
		case <-done:
			if !test.doExchange {
				t.Errorf("%d: should not have done code exchange", i)
			}
		default:
			if test.doExchange {
				t.Errorf("%d: code exchange never happened", i)
			}
		}

		// TODO: remove !isGAEtest when standalone DB is implemented
		if !test.success || !isGAEtest {
			continue
		}

		cred, err := getCredentials(c, testUserID)

		if err != nil {
			t.Errorf("%d: getCredentials: %v", i, err)
		}
		if cred.AccessToken != "new-access-token" {
			t.Errorf("%d: cred.AccessToken = %q; want 'new-access-token'", i, cred.AccessToken)
		}
		if cred.RefreshToken != "new-refresh-token" {
			t.Errorf("%d: cred.RefreshToken = %q; want 'new-refresh-token'", i, cred.RefreshToken)
		}
		if cred.Expiry.Before(time.Now()) {
			t.Errorf("%d: cred.Expiry is in the past: %s", i, cred.Expiry)
		}
	}
}

func TestHandleAuthNoRefresh(t *testing.T) {
	defer resetTestState(t)
	defer preserveConfig()()

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{
			"access_token": "new-access-token",
			"id_token": %q,
			"expires_in": 3600
		}`, testIDToken)
	}))
	defer ts.Close()
	config.Google.TokenURL = ts.URL

	r := newTestRequest(t, "POST", "/api/v1/auth", strings.NewReader(`{"code": "one-off"}`))
	r.Header.Set("Authorization", "Bearer "+testIDToken)
	w := httptest.NewRecorder()

	c := newContext(r)
	cache.flush(c)
	handleAuth(w, r)

	if w.Code != 498 {
		t.Errorf("w.Code = %d; want 498\nResponse: %s", w.Code, w.Body.String())
	}
}

func TestServeUserScheduleExpired(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	c := newContext(newTestRequest(t, "GET", "/dummy", nil))
	if err := storeCredentials(c, &oauth2Credentials{
		userID:       testUserID,
		Expiry:       time.Now().Add(-1 * time.Hour),
		AccessToken:  "access-token",
		RefreshToken: "refresh-token",
	}); err != nil {
		t.Fatal(err)
	}

	// Refresh token server stub
	tokens := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{
      "access_token":"new-access",
      "expires_in":3600,
      "token_type":"Bearer"
    }`))
	}))
	defer tokens.Close()
	config.Google.TokenURL = tokens.URL

	// Google Drive stub
	var gdrive *httptest.Server
	gdrive = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ah := r.Header.Get("authorization")
		if ah == "" || !strings.HasPrefix(strings.ToLower(ah), "bearer ") {
			t.Errorf("gdrive %s: bad authorization header: %q", r.URL.Path, ah)
		} else if ah = ah[7:]; ah != "new-access" {
			t.Errorf("gdrive %s: authorization = %q; want new-access", r.URL.Path, ah)
		}

		if r.URL.Path == "/file-id" {
			if r.FormValue("alt") != "media" {
				t.Errorf("alt = %q; want 'media'", r.FormValue("alt"))
			}
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"starred_sessions": ["dummy-session-id"]}`))
			return
		}

		if r.URL.Path != "/" {
			t.Errorf("r.URL.Path = %q; want '/'", r.URL.Path)
		}

		q := "'appfolder' in parents and title = 'user_data.json'"
		if r.FormValue("q") != q {
			t.Errorf("q = %q; want %q\nForm: %v", r.FormValue("q"), q, r.Form)
		}

		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"items": [
			{
				"id": "not-this-one",
				"modifiedDate": "2015-04-10T12:12:46.034Z"
			},
			{
				"id": "file-id",
				"modifiedDate": "2015-04-11T12:12:46.034Z"
			}
		]}`)
	}))
	defer gdrive.Close()
	config.Google.Drive.FilesURL = gdrive.URL + "/"
	config.Google.Drive.Filename = "user_data.json"

	w := httptest.NewRecorder()
	r := newTestRequest(t, "GET", "/api/v1/user/schedule", nil)
	r.Header.Set("Authorization", "Bearer "+testIDToken)

	handleUserSchedule(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("w.Code = %d; want 200", w.Code)
	}
	var list []string
	if err := json.Unmarshal(w.Body.Bytes(), &list); err != nil {
		t.Fatalf("json.Unmarshal: %v\nResponse: %s", err, w.Body.String())
	}
	if len(list) != 1 || list[0] != "dummy-session-id" {
		t.Errorf("list = %v; want ['dummy-session-id']\nResponse: %s", list, w.Body.String())
	}

	cred, err := getCredentials(c, testUserID)
	if err != nil {
		t.Fatal(err)
	}
	if cred.AccessToken != "new-access" {
		t.Errorf("cred.AccessToken = %q; want 'new-access'", cred.AccessToken)
	}
	if cred.RefreshToken == "" {
		t.Errorf("cred.RefreshToken is empty")
	}
	if !cred.Expiry.After(time.Now()) {
		t.Errorf("cred is expired: %s", cred.Expiry)
	}
}

func TestHandleUserSchedulePut(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	checkAutHeader := func(who, ah string) {
		if ah == "" || !strings.HasPrefix(strings.ToLower(ah), "bearer ") {
			t.Errorf("%s: bad authorization header: %q", who, ah)
		} else if ah = ah[7:]; ah != "dummy-access" {
			t.Errorf("%s: authorization = %q; want dummy-access", who, ah)
		}
	}

	checkMetadata := func(r io.Reader) {
		var data struct {
			Title    string `json:"title"`
			MimeType string `json:"mimeType"`
			Parents  []struct {
				Id string `json:"id"`
			}
		}
		if err := json.NewDecoder(r).Decode(&data); err != nil {
			t.Errorf("checkMetadata: %v", err)
			return
		}
		if data.Title != "user_data.json" {
			t.Errorf("checkMetadata: data.Title = %q; want user_data.json", data.Title)
		}
		if data.MimeType != "application/json" {
			t.Errorf("checkMetadata: data.MimeType = %q; want application/json", data.MimeType)
		}
		if len(data.Parents) != 1 || data.Parents[0].Id != "appfolder" {
			t.Errorf(`checkMetadata: data.Parents = %+v; want [{"id":"appfolder"}]`, data.Parents)
		}
	}

	expBookmarks := append(defaultBookmarks, "new-session-id")
	checkMedia := func(r io.Reader) {
		var data appFolderData
		if err := json.NewDecoder(r).Decode(&data); err != nil {
			t.Errorf("checkMedia: %v", err)
			return
		}
		if !compareStringSlices(data.Bookmarks, expBookmarks) {
			t.Errorf("checkMedia: data.Bookmarks = %v; want %v", data.Bookmarks, expBookmarks)
		}
	}

	// drive search files server
	files := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		checkAutHeader("files", r.Header.Get("authorization"))
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"items":[]}`))
	}))
	defer files.Close()

	// drive upload server
	upload := make(chan struct{}, 1)
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		checkAutHeader("upload", r.Header.Get("authorization"))

		if v, ok := r.Header["If-Match"]; ok {
			t.Errorf("if-match = %q; want none", v)
		}

		mediaType, params, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if err != nil {
			t.Fatalf("mime.ParseMediaType: %v", err)
		}
		if mediaType != "multipart/related" {
			t.Errorf("mediaType = %q; want multipart/related", mediaType)
		}

		mr := multipart.NewReader(r.Body, params["boundary"])
		count := 0
		for {
			p, err := mr.NextPart()
			if err == io.EOF {
				break
			}
			if err != nil {
				t.Fatalf("%d: mr.NextPart: %v", count, err)
			}
			if v := p.Header.Get("Content-Type"); !strings.HasPrefix(v, "application/json") {
				t.Errorf("%d: content-type = %q; want application/json", count, v)
			}
			switch count {
			case 0:
				checkMetadata(p)
			case 1:
				checkMedia(p)
			}
			count += 1
		}
		if count != 2 {
			t.Errorf("num. of parts = %d; want 2", count)
		}

		w.Header().Set("etag", `"new-etag"`)
		fmt.Fprint(w, `{"id": "new-file-id"}`)

		upload <- struct{}{}
	}))
	defer up.Close()

	config.Google.Drive.FilesURL = files.URL + "/"
	config.Google.Drive.UploadURL = up.URL + "/"
	config.Google.Drive.Filename = "user_data.json"

	c := newContext(newTestRequest(t, "GET", "/", nil))
	cred := &oauth2Credentials{
		userID:      testUserID,
		Expiry:      time.Now().Add(2 * time.Hour),
		AccessToken: "dummy-access",
	}
	if err := storeCredentials(c, cred); err != nil {
		t.Fatalf("storeCredentials: %v", err)
	}

	w := httptest.NewRecorder()
	r := newTestRequest(t, "PUT", "/api/v1/user/schedule/new-session-id", strings.NewReader(""))
	r.Header.Set("Authorization", "Bearer "+testIDToken)

	handleUserSchedule(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("w.Code = %d; want 200", w.Code)
	}
	select {
	case <-upload:
		// passed
	default:
		t.Errorf("upload never happened")
	}

	var list []string
	if err := json.Unmarshal(w.Body.Bytes(), &list); err != nil {
		t.Fatalf("Unmarshal(response): %v", err)
	}
	if !compareStringSlices(list, expBookmarks) {
		t.Errorf("list = %v; want %v", list, expBookmarks)
	}

	data, err := getLocalAppFolderMeta(c, testUserID)
	if err != nil {
		t.Fatal(err)
	}
	if data.FileID != "new-file-id" {
		t.Errorf("data.FileID = %q; want 'new-file-id'", data.FileID)
	}
	if data.Etag != "new-etag" {
		t.Errorf("data.Etag = %q; want 'new-etag'", data.Etag)
	}
}

func TestHandleUserScheduleDelete(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	// drive search files server
	files := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.URL.Path == "/file-id" {
			w.Write([]byte(`{"starred_sessions": ["one-session", "two-session"]}`))
			return
		}

		q := "'appfolder' in parents and title = 'user_data.json'"
		if v := r.FormValue("q"); v != q {
			t.Errorf("q = %q; want %q\nForm: %v", v, q, r.Form)
		}
		fmt.Fprintf(w, `{"items": [{
			"etag": "\"some-etag\"",
      "id": "file-id",
      "modifiedDate": "2015-04-11T12:12:46.034Z"
    }]}`)
	}))
	defer files.Close()

	// drive upload server
	upload := make(chan struct{}, 1)
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() { upload <- struct{}{} }()
		if v := r.Header.Get("if-match"); v != `"some-etag"` {
			t.Errorf(`if-match = %q; want "\"some-etag\""`, v)
		}
		var data appFolderData
		if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
			t.Fatal(err)
		}
		if len(data.Bookmarks) != 1 || data.Bookmarks[0] != "two-session" {
			t.Errorf("data.Bookmarks = %v; want ['two-session']", data.Bookmarks)
		}
		w.Header().Set("etag", `"new-etag"`)
		w.WriteHeader(http.StatusOK)
	}))
	defer up.Close()

	config.Google.Drive.FilesURL = files.URL + "/"
	config.Google.Drive.UploadURL = up.URL + "/"
	config.Google.Drive.Filename = "user_data.json"

	c := newContext(newTestRequest(t, "GET", "/", nil))
	cred := &oauth2Credentials{
		userID:      testUserID,
		Expiry:      time.Now().Add(2 * time.Hour),
		AccessToken: "dummy-access",
	}
	if err := storeCredentials(c, cred); err != nil {
		t.Fatalf("storeCredentials: %v", err)
	}

	w := httptest.NewRecorder()
	r := newTestRequest(t, "DELETE", "/api/v1/user/schedule/one-session", strings.NewReader(""))
	r.Header.Set("Authorization", "Bearer "+testIDToken)

	handleUserSchedule(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("w.Code = %d; want 200", w.Code)
	}
	select {
	case <-upload:
		// passed
	default:
		t.Errorf("upload never happened")
	}

	var list []string
	if err := json.Unmarshal(w.Body.Bytes(), &list); err != nil {
		t.Fatalf("Unmarshal(response): %v", err)
	}
	if len(list) != 1 || list[0] != "two-session" {
		t.Errorf("list = %v; want ['two-session']", list)
	}

	data, err := getLocalAppFolderMeta(c, testUserID)
	if err != nil {
		t.Fatal(err)
	}
	if data.FileID != "file-id" {
		t.Errorf("data.FileID = %q; want 'file-id'", data.FileID)
	}
	if data.Etag != "new-etag" {
		t.Errorf("data.Etag = %q; want 'new-etag'", data.Etag)
	}
}

func TestHandleUserScheduleConflict(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	// drive search files server
	files := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			fmt.Fprintf(w, `{"items": [
				{
					"etag": "\"new-etag\"",
					"id": "new-file-id",
					"modifiedDate": "2015-04-11T12:12:46.034Z"
				}
			]}`)
			return
		}

		if r.URL.Path == "/file-id" {
			w.Write([]byte(`{"starred_sessions": ["a"]}`))
			return
		}

		if r.URL.Path != "/new-file-id" {
			t.Errorf("r.URL.Path = %q; want /new-file-id", r.URL.Path)
		}
		w.Write([]byte(`{"starred_sessions": ["a", "b"]}`))
	}))
	defer files.Close()

	// drive upload server
	upcount := 0
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() { upcount += 1 }()

		if r.Header.Get("if-match") == `"some-etag"` {
			w.WriteHeader(http.StatusPreconditionFailed)
			return
		}

		if v := r.Header.Get("if-match"); v != `"new-etag"` {
			t.Errorf("if-match = %q; want new-etag", v)
		}
		var data appFolderData
		if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
			t.Fatal(err)
		}
		if v := []string{"a", "b", "c"}; !reflect.DeepEqual(data.Bookmarks, v) {
			t.Errorf("data.Bookmarks = %v; want %v", data.Bookmarks, v)
		}
		w.Header().Set("etag", `"even-newer-etag"`)
		w.WriteHeader(http.StatusOK)
	}))
	defer up.Close()

	config.Google.Drive.FilesURL = files.URL + "/"
	config.Google.Drive.UploadURL = up.URL + "/"
	config.Google.Drive.Filename = "user_data.json"

	c := newContext(newTestRequest(t, "GET", "/", nil))
	if err := storeCredentials(c, &oauth2Credentials{
		userID:      testUserID,
		Expiry:      time.Now().Add(2 * time.Hour),
		AccessToken: "dummy-access",
	}); err != nil {
		t.Fatal(err)
	}
	if err := storeLocalAppFolderMeta(c, testUserID, &appFolderData{
		FileID: "file-id",
		Etag:   "some-etag",
	}); err != nil {
		t.Fatal(err)
	}

	w := httptest.NewRecorder()
	r := newTestRequest(t, "PUT", "/api/v1/user/schedule", strings.NewReader(`["b", "c"]`))
	r.Header.Set("Authorization", "Bearer "+testIDToken)

	handleUserSchedule(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("w.Code = %d; want 200", w.Code)
	}
	if upcount != 2 {
		t.Errorf("upcount = %d; want 2", upcount)
	}

	var list []string
	if err := json.Unmarshal(w.Body.Bytes(), &list); err != nil {
		t.Fatalf("Unmarshal(%s): %v", w.Body.String(), err)
	}
	if v := []string{"a", "b", "c"}; !reflect.DeepEqual(list, v) {
		t.Errorf("list = %v; want %v", list, v)
	}

	data, err := getLocalAppFolderMeta(c, testUserID)
	if err != nil {
		t.Fatal(err)
	}
	if data.FileID != "new-file-id" {
		t.Errorf("data.FileID = %q; want new-file-id", data.FileID)
	}
	if data.Etag != "even-newer-etag" {
		t.Errorf("data.Etag = %q; want even-newer-etag", data.Etag)
	}
}

func TestServeUserScheduleDefault(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	gdrive := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"items":[]}`))
	}))
	defer gdrive.Close()
	config.Google.Drive.FilesURL = gdrive.URL + "/"

	r := newTestRequest(t, "GET", "/api/v1/user/schedule", nil)
	r.Header.Set("authorization", bearerHeader+testIDToken)
	c := newContext(r)

	if err := storeCredentials(c, &oauth2Credentials{
		userID:      testUserID,
		Expiry:      time.Now().Add(2 * time.Hour),
		AccessToken: "dummy-access",
	}); err != nil {
		t.Fatalf("storeCredentials: %v", err)
	}

	w := httptest.NewRecorder()
	handleUserSchedule(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("w.Code = %d; want 200\nResponse: %s", w.Code, w.Body.String())
	}

	var list []string
	if err := json.Unmarshal(w.Body.Bytes(), &list); err != nil {
		t.Fatalf("Unmarshal(response): %v", err)
	}
	if !compareStringSlices(list, defaultBookmarks) {
		t.Errorf("list = %v; want %v", list, defaultBookmarks)
	}
}

func TestServeUserSurvey(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	gdrive := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"feedback_submitted_sessions": ["id-1", "id-2"]}`))
	}))
	defer gdrive.Close()
	config.Google.Drive.FilesURL = gdrive.URL

	r := newTestRequest(t, "GET", "/api/v1/user/survey", nil)
	r.Header.Set("authorization", bearerHeader+testIDToken)
	c := newContext(r)

	if err := storeCredentials(c, &oauth2Credentials{
		userID:      testUserID,
		Expiry:      time.Now().Add(2 * time.Hour),
		AccessToken: "dummy-access",
	}); err != nil {
		t.Fatal(err)
	}
	if err := storeLocalAppFolderMeta(c, testUserID, &appFolderData{
		FileID: "file-123",
		Etag:   "xxx",
	}); err != nil {
		t.Fatal(err)
	}

	w := httptest.NewRecorder()
	handleUserSurvey(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("w.Code = %d; want 200\nResponse: %s", w.Code, w.Body.String())
	}

	var list []string
	if err := json.Unmarshal(w.Body.Bytes(), &list); err != nil {
		t.Fatal(err)
	}
	ids := []string{"id-1", "id-2"}
	if !compareStringSlices(list, ids) {
		t.Errorf("list = %v; want %v", list, ids)
	}
}

func TestSubmitUserSurvey(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	c := newContext(newTestRequest(t, "GET", "/dummy", nil))
	if err := storeCredentials(c, &oauth2Credentials{
		userID:      testUserID,
		Expiry:      time.Now().Add(2 * time.Hour),
		AccessToken: "dummy-access",
	}); err != nil {
		t.Fatal(err)
	}
	if err := storeLocalAppFolderMeta(c, testUserID, &appFolderData{
		FileID: "file-123",
		Etag:   "xxx",
	}); err != nil {
		t.Fatal(err)
	}
	if err := storeEventData(c, &eventData{Sessions: map[string]*eventSession{
		"ok":        &eventSession{Id: "ok", StartTime: time.Now().Add(-10 * time.Minute)},
		"submitted": &eventSession{Id: "submitted", StartTime: time.Now().Add(-10 * time.Minute)},
		"disabled":  &eventSession{Id: "disabled", StartTime: time.Now().Add(-10 * time.Minute)},
		"too-early": &eventSession{Id: "too-early", StartTime: time.Now().Add(10 * time.Minute)},
	}}); err != nil {
		t.Fatal(err)
	}

	// Google Drive API endpoint
	feedbackIDs := []string{"submitted", "ok"}
	gdrive := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == "GET" {
			w.Write([]byte(`{
				"starred_sessions": ["submitted", "too-early", "disabled"],
				"feedback_submitted_sessions": ["submitted"]
			}`))
			return
		}
		data := &appFolderData{}
		if err := json.NewDecoder(r.Body).Decode(data); err != nil {
			t.Error(err)
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if v := []string{"submitted", "too-early", "disabled"}; !compareStringSlices(data.Bookmarks, v) {
			t.Errorf("data.Bookmarks = %v; want %v", data.Bookmarks, v)
		}
		if !compareStringSlices(data.Survey, feedbackIDs) {
			t.Errorf("data.Survey = %v; want %v", data.Survey, feedbackIDs)
		}
	}))
	defer gdrive.Close()

	// Survey API endpoint
	submitted := false
	ep := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() { submitted = true }()
		if h := r.Header.Get("code"); h != "ep-code" {
			t.Errorf("code = %q; want 'ep-code'", h)
		}
		if h := r.Header.Get("apikey"); h != "ep-key" {
			t.Errorf("apikey = %q; want 'ep-key'", h)
		}
		if err := r.ParseForm(); err != nil {
			t.Errorf("r.ParseForm: %v", err)
			return
		}
		params := url.Values{
			"surveyId":      {"io-survey"},
			"objectid":      {"ok-mapped"},
			"registrantKey": {"registrant"},
			"q1-param":      {"five"},
			"q2-param":      {"four"},
			"q3-param":      {"three"},
			"q4-param":      {"two"},
			"q5-param":      {""},
		}
		if !reflect.DeepEqual(r.Form, params) {
			t.Errorf("r.Form = %v; want %v", r.Form, params)
		}
	}))
	defer ep.Close()

	config.Env = "prod"
	config.Google.Drive.FilesURL = gdrive.URL
	config.Google.Drive.UploadURL = gdrive.URL
	config.Survey.Endpoint = ep.URL + "/"
	config.Survey.ID = "io-survey"
	config.Survey.Reg = "registrant"
	config.Survey.Key = "ep-key"
	config.Survey.Code = "ep-code"
	config.Survey.Disabled = []string{"disabled"}
	config.Survey.Smap = map[string]string{
		"ok": "ok-mapped",
	}
	config.Survey.Qmap.Q1.Name = "q1-param"
	config.Survey.Qmap.Q1.Answers = map[string]string{"5": "five"}
	config.Survey.Qmap.Q2.Name = "q2-param"
	config.Survey.Qmap.Q2.Answers = map[string]string{"4": "four"}
	config.Survey.Qmap.Q3.Name = "q3-param"
	config.Survey.Qmap.Q3.Answers = map[string]string{"3": "three"}
	config.Survey.Qmap.Q4.Name = "q4-param"
	config.Survey.Qmap.Q4.Answers = map[string]string{"2": "two"}
	config.Survey.Qmap.Q5.Name = "q5-param"

	const feedback = `{
		"overall": "5",
		"relevance": "4",
		"content": "3",
		"speaker": "2"
	}`

	table := []*struct {
		sid  string
		code int
	}{
		{"ok", http.StatusCreated},
		{"not-there", http.StatusNotFound},
		{"submitted", http.StatusBadRequest},
		{"disabled", http.StatusBadRequest},
		{"too-early", http.StatusBadRequest},
		{"", http.StatusNotFound},
	}

	for i, test := range table {
		submitted = false
		r := newTestRequest(t, "PUT", "/api/v1/user/survey/"+test.sid, strings.NewReader(feedback))
		r.Header.Set("authorization", bearerHeader+testIDToken)
		w := httptest.NewRecorder()
		handleUserSurvey(w, r)

		if w.Code != test.code {
			t.Errorf("%d: w.Code = %d; want %d\nResponse: %s", i, w.Code, test.code, w.Body.String())
		}
		if test.code > 299 {
			if submitted {
				t.Errorf("%d: submitted = true; want false", i)
			}
			continue
		}

		var list []string
		if err := json.Unmarshal(w.Body.Bytes(), &list); err != nil {
			t.Fatalf("%d: %v", i, err)
		}
		if !compareStringSlices(list, feedbackIDs) {
			t.Errorf("%d: list = %v; want %v", i, list, feedbackIDs)
		}

		if !submitted {
			t.Errorf("%d: submitted = false; want true", i)
		}
	}
}

func TestGetUserDefaultPushConfig(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)

	w := httptest.NewRecorder()
	r := newTestRequest(t, "GET", "/api/v1/user/notify", nil)
	r.Header.Set("Authorization", "Bearer "+testIDToken)

	handleUserNotifySettings(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("w.Code = %d; want 200", w.Code)
	}
	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal: %v", err)
	}
	if v, ok := body["notify"].(bool); !ok || v != false {
		t.Errorf("body.notify = %+v, ok = %v; want notify = false", body["notify"], ok)
	}
	if v := body["subscribers"]; v != nil {
		t.Errorf("body.subscribers = %+v; want nil", v)
	}
	if v := body["ioext"]; v != nil {
		t.Errorf("body.ioext = %+v; want nil", v)
	}
}

func TestStoreUserPushConfigV1(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()
	config.Google.GCM.Endpoint = "https://gcm"

	table := []*struct{ body, endpoint string }{
		{`{"subscriber": "reg-123", "endpoint": "https://push"}`, "https://push/reg-123"},
		{`{"subscriber": "reg-123", "endpoint": ""}`, "https://gcm/reg-123"},
		{`{"subscriber": "reg-123"}`, "https://gcm/reg-123"},
	}

	for i, test := range table {
		resetTestState(t)
		r := newTestRequest(t, "PUT", "/api/v1/user/notify", strings.NewReader(test.body))
		r.Header.Set("Authorization", "Bearer "+testIDToken)
		w := httptest.NewRecorder()

		handleUserNotifySettings(w, r)

		if w.Code != http.StatusOK {
			t.Errorf("%d: w.Code = %d; want 200\nResponse: %s", i, w.Code, w.Body.String())
		}
		pi, err := getUserPushInfo(newContext(r), testUserID)
		if err != nil {
			t.Errorf("%d: %v", i, err)
			continue
		}
		if len(pi.Endpoints) != 1 || pi.Endpoints[0] != test.endpoint {
			t.Errorf("%d: pi.Endpoints = %v; want [%q]", i, pi.Endpoints, test.endpoint)
		}
		if len(pi.Subscribers) != 0 {
			t.Errorf("%d: pi.Subscribers = %v; want []", i, pi.Subscribers)
		}
	}
}
func TestStoreUserPushConfigV2(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	config.Google.GCM.Endpoint = "https://gcm"
	body := strings.NewReader(`{
		"notify": true,
		"endpoint": "https://gcm/reg-id",
		"iostart": true,
		"ioext": {
			"name": "Amsterdam",
			"lat": 52.37607,
			"lng": 4.886114
		}
	}`)
	expected := &userPush{
		userID:    testUserID,
		Enabled:   true,
		Endpoints: []string{"https://gcm/reg-id"},
		IOStart:   true,
		Ext: ioExtPush{
			Enabled: true,
			Name:    "Amsterdam",
			Lat:     52.37607,
			Lng:     4.886114,
		},
	}
	expected.Pext = &expected.Ext

	w := httptest.NewRecorder()
	r := newTestRequest(t, "PUT", "/api/v1/user/notify", body)
	r.Header.Set("Authorization", "Bearer "+testIDToken)

	handleUserNotifySettings(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("w.Code = %d; want 200\nResponse: %s", w.Code, w.Body.String())
	}

	var p1 userPush
	if err := json.Unmarshal(w.Body.Bytes(), &p1); err != nil {
		t.Errorf("json.Unmarshal: %v", err)
	}
	if p1.Pext != nil {
		p1.Pext.Enabled = true
	}
	if !reflect.DeepEqual(p1.Pext, expected.Pext) {
		t.Errorf("p1.Pext = %+v; want %+v\nResponse: %s", p1.Pext, expected.Pext, w.Body.String())
	}
	p1.userID = expected.userID
	p1.Pext = expected.Pext
	p1.Ext = expected.Ext
	if !reflect.DeepEqual(&p1, expected) {
		t.Errorf("p1 = %+v; want %+v\nResponse: %s", p1, expected, w.Body.String())
	}

	p2, err := getUserPushInfo(newContext(r), testUserID)
	if err != nil {
		t.Errorf("getUserPushInfo: %v", err)
	}
	if !reflect.DeepEqual(p2, expected) {
		t.Errorf("p2 = %+v; want %+v", p2, expected)
	}
	if !reflect.DeepEqual(p2.Pext, expected.Pext) {
		t.Errorf("p2.Pext = %+v; want %+v", p2.Pext, expected.Pext)
	}
}

func TestFirstSyncEventData(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	lastMod := time.Date(2015, 4, 15, 0, 0, 0, 0, time.UTC)
	startDate := time.Date(2015, 5, 28, 22, 0, 0, 0, time.UTC)

	const scheduleFile = `{
		"rooms":[
			{
				"id":"room-id",
				"name":"Community Lounge"
			}
		],
		"video_library":[
			{
				"thumbnailUrl":"http://img.youtube.com/test.jpg",
				"id":"video-id",
				"title":"Map Up your Apps!",
				"desc":"video desc",
				"year":2015,
				"topic":"Tools",
				"speakers":"Some Dude"
			}
		],
		"sessions":[
			{
				"id":"session-id",
				"url":"https://www.google.com",
				"title":"Introduction to Classroom",
				"description":"session desc",
				"startTimestamp":"2015-05-28T22:00:00Z",
				"endTimestamp":"2015-05-28T23:00:00Z",
				"isLivestream":true,
				"tags":["TYPE_BOXTALKS"],
				"speakers":["speaker-id"],
				"room":"room-id"
			}
		],
		"speakers":[
			{
				"id":"speaker-id",
				"name":"Google Devs",
				"bio":"speaker bio",
				"company":"Google",
				"plusoneUrl":"https://plus.google.com/user-id",
				"twitterUrl":"https://twitter.com/googledevs"
			}
		],
		"tags":[
			{
				"category":"TYPE",
				"tag":"TYPE_BOXTALKS",
				"name":"Boxtalks"
			}
		]
	}`

	video := &eventVideo{
		Thumb:    "http://img.youtube.com/test.jpg",
		Id:       "video-id",
		Title:    "Map Up your Apps!",
		Desc:     "video desc",
		Topic:    "Tools",
		Speakers: "Some Dude",
	}
	session := &eventSession{
		Id:        "session-id",
		Title:     "Introduction to Classroom",
		Desc:      "session desc",
		IsLive:    true,
		Tags:      []string{"TYPE_BOXTALKS"},
		Speakers:  []string{"speaker-id"},
		Room:      "Community Lounge",
		StartTime: startDate,
		EndTime:   startDate.Add(1 * time.Hour),
		Day:       28,
		Block:     "3 PM",
		Start:     "3:00 PM",
		End:       "4:00 PM",
		Filters: map[string]bool{
			"Boxtalks":       true,
			liveStreamedText: true,
		},
	}
	speaker := &eventSpeaker{
		Id:      "speaker-id",
		Name:    "Google Devs",
		Bio:     "speaker bio",
		Company: "Google",
		Plusone: "https://plus.google.com/user-id",
		Twitter: "https://twitter.com/googledevs",
	}
	tag := &eventTag{
		Cat:  "TYPE",
		Tag:  "TYPE_BOXTALKS",
		Name: "Boxtalks",
	}

	done := make(chan struct{}, 1)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/manifest.json" {
			w.Header().Set("last-modified", lastMod.Format(http.TimeFormat))
			w.Write([]byte(`{"data_files": ["schedule.json"]}`))
			return
		}
		if r.URL.Path != "/schedule.json" {
			t.Errorf("slurp path = %q; want /schedule.json", r.URL.Path)
		}
		w.Write([]byte(scheduleFile))
		done <- struct{}{}
	}))
	defer ts.Close()

	config.Schedule.ManifestURL = ts.URL + "/manifest.json"
	config.Schedule.Start = startDate

	r := newTestRequest(t, "POST", "/sync/gcs", nil)
	r.Header.Set("x-goog-channel-token", "sync-token")
	w := httptest.NewRecorder()
	syncEventData(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("w.Code = %d; want 200", w.Code)
	}

	select {
	case <-done:
		// passed
	default:
		t.Fatalf("slurp never happened")
	}

	data, err := getLatestEventData(newContext(r), nil)
	if err != nil {
		t.Fatalf("getLatestEventData: %v", err)
	}
	if data.modified.Unix() != lastMod.Unix() {
		t.Errorf("data.modified = %s; want %s", data.modified, lastMod)
	}
	if v := data.Videos["video-id"]; !reflect.DeepEqual(v, video) {
		t.Errorf("video = %+v\nwant %+v", v, video)
	}
	if v := data.Sessions["session-id"]; !reflect.DeepEqual(v, session) {
		t.Errorf("session = %+v\nwant %+v", v, session)
	}
	if v := data.Speakers["speaker-id"]; !reflect.DeepEqual(v, speaker) {
		t.Errorf("speaker = %+v\nwant %+v", v, speaker)
	}
	if v := data.Tags["TYPE_BOXTALKS"]; !reflect.DeepEqual(v, tag) {
		t.Errorf("tag = %+v\nwant %+v", v, tag)
	}
}

func TestSyncEventDataEmtpyDiff(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	const scheduleFile = `{
		"sessions":[
			{
				"id":"__keynote__",
				"url":"https://events.google.com/io2015/",
				"title":"Keynote",
				"description":"DESCRIPTION",
				"startTimestamp":"2015-05-28T22:00:00Z",
				"endTimestamp":"2015-05-28T23:00:00Z",
				"isLivestream":true,
				"tags":["FLAG_KEYNOTE"],
				"speakers":[],
				"room":"room-id",
				"photoUrl": "http://example.org/photo",
				"youtubeUrl": "http://example.org/video"
			}
		]
	}`

	times := []time.Time{time.Now().UTC(), time.Now().Add(10 * time.Second).UTC()}
	mcount, scount := 0, 0
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/manifest.json" {
			w.Header().Set("last-modified", times[mcount].Format(http.TimeFormat))
			w.Write([]byte(`{"data_files": ["schedule.json"]}`))
			mcount += 1
			return
		}
		w.Write([]byte(scheduleFile))
		scount += 1
	}))
	defer ts.Close()

	config.Schedule.ManifestURL = ts.URL + "/manifest.json"
	config.Schedule.Start = time.Date(2015, 5, 28, 9, 30, 0, 0, time.UTC)

	r := newTestRequest(t, "POST", "/sync/gcs", nil)
	r.Header.Set("x-goog-channel-token", "sync-token")
	w := httptest.NewRecorder()
	c := newContext(r)

	for i := 1; i < 3; i += 1 {
		syncEventData(w, r)
		if w.Code != http.StatusOK {
			t.Errorf("w.Code = %d; want 200", w.Code)
		}
		if mcount != i || scount != i {
			t.Errorf("mcount = %d, scount = %d; want both %d", mcount, scount, i)
		}

		dc, err := getChangesSince(c, times[0].Add(-10*time.Second))
		if err != nil {
			t.Fatalf("getChangesSince: %v", err)
		}
		if l := len(dc.Sessions); l != 0 {
			t.Errorf("len(dc.Sessions) = %d; want 0\ndc.Sessions: %v", l, dc.Sessions)
		}
	}
}

func TestSyncEventDataWithDiff(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	firstMod := time.Date(2015, 4, 15, 0, 0, 0, 0, time.UTC)
	lastMod := firstMod.AddDate(0, 0, 1)

	startDate := time.Date(2015, 5, 28, 22, 0, 0, 0, time.UTC)
	session := &eventSession{
		Id:        "test-session",
		Title:     "Introduction to Classroom",
		Desc:      "session desc",
		IsLive:    true,
		Tags:      []string{"TYPE_BOXTALKS"},
		Speakers:  []string{"speaker-id"},
		Room:      "Community Lounge",
		StartTime: startDate,
		EndTime:   startDate.Add(1 * time.Hour),
		Day:       1,
		Block:     "3 PM",
		Start:     "3:00 PM",
		End:       "4:00 PM",
		Filters: map[string]bool{
			"Boxtalks":       true,
			liveStreamedText: true,
		},
	}

	r := newTestRequest(t, "POST", "/sync/gcs", nil)
	r.Header.Set("x-goog-channel-token", "sync-token")
	c := newContext(r)

	err := storeEventData(c, &eventData{
		modified: firstMod,
		Sessions: map[string]*eventSession{session.Id: session},
	})
	if err != nil {
		t.Fatalf("storeEventData: %v", err)
	}
	err = storeChanges(c, &dataChanges{
		Updated: firstMod,
		eventData: eventData{
			Videos: map[string]*eventVideo{"dummy-id": &eventVideo{}},
		},
	})
	if err != nil {
		t.Fatalf("storeChanges: %v", err)
	}

	const newScheduleFile = `{
		"sessions":[
			{
				"id":"test-session",
				"url":"https://www.google.com",
				"title":"Introduction to Classroom",
				"description":"CHANGED DESCRIPTION",
				"startTimestamp":"2015-05-28T22:00:00Z",
				"endTimestamp":"2015-05-28T23:00:00Z",
				"isLivestream":true,
				"tags":["TYPE_BOXTALKS"],
				"speakers":["speaker-id"],
				"room":"room-id"
			}
		]
	}`

	done := make(chan struct{}, 1)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/manifest.json" {
			sinceStr := r.Header.Get("if-modified-since")
			since, err := time.ParseInLocation(http.TimeFormat, sinceStr, time.UTC)
			if err != nil {
				t.Errorf("if-modified-since: time.Parse(%q): %v", sinceStr, err)
			}
			if since != firstMod {
				t.Errorf("if-modified-since (%q) = %s; want %s", sinceStr, since, firstMod)
			}
			w.Header().Set("last-modified", lastMod.Format(http.TimeFormat))
			w.Write([]byte(`{"data_files": ["schedule.json"]}`))
			return
		}
		w.Write([]byte(newScheduleFile))
		done <- struct{}{}
	}))
	defer ts.Close()

	config.Schedule.ManifestURL = ts.URL + "/manifest.json"
	config.Schedule.Start = startDate

	w := httptest.NewRecorder()
	syncEventData(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("w.Code = %d; want 200", w.Code)
	}

	select {
	case <-done:
		// passed
	default:
		t.Fatalf("slurp never happened")
	}

	cache.flush(c)
	data, err := getLatestEventData(c, nil)
	if err != nil {
		t.Fatalf("getLatestEventData: %v", err)
	}
	if data.modified.Unix() != lastMod.Unix() {
		t.Errorf("data.modified = %s; want %s", data.modified, lastMod)
	}

	s := data.Sessions[session.Id]
	if s == nil {
		t.Fatalf("%q session not found in %+v", session.Id, data.Sessions)
	}
	if v := "CHANGED DESCRIPTION"; s.Desc != v {
		t.Errorf("s.Desc = %q; want %q", s.Desc, v)
	}

	dc, err := getChangesSince(c, firstMod.Add(1*time.Second))
	if err != nil {
		t.Fatalf("getChangesAfter: %v", err)
	}
	if dc.Updated != lastMod {
		t.Errorf("dc.Changed = %s; want %s", dc.Updated, lastMod)
	}
	if l := len(dc.Videos); l != 0 {
		t.Errorf("len(dc.Videos) = %d; want 0", l)
	}
	s.Update = updateDetails
	if s2 := dc.Sessions[session.Id]; !reflect.DeepEqual(s2, s) {
		t.Errorf("s2 = %+v\nwant %+v", s2, s)
	}
}

func TestServeSWToken(t *testing.T) {
	defer resetTestState(t)

	r := newTestRequest(t, "GET", "/api/v1/user/updates", nil)
	r.Header.Set("authorization", "bearer "+testIDToken)
	w := httptest.NewRecorder()
	serveUserUpdates(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("w.Code = %d; want 200", w.Code)
	}

	var body struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("json.Unmarshal(%q): %v", w.Body.String(), err)
	}

	user, ts, err := decodeSWToken(body.Token)
	if err != nil {
		t.Fatalf("decodeSWToken(%q): %v", body.Token, err)
	}
	if user != testUserID {
		t.Errorf("user = %q; want %q", user, testUserID)
	}
	if now := time.Now(); now.Unix()-ts.Unix() > 3 {
		t.Errorf("ts = %s; want around %s", ts, now)
	}
}

func TestServeUserUpdates(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	// gdrive stub
	var gdrive *httptest.Server
	gdrive = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/list" {
			fmt.Fprintf(w, `{"items": [
        {
          "id": "file-id",
          "modifiedDate": "2015-04-11T12:12:46.034Z",
          "downloadUrl": %q
        }
      ]}`, gdrive.URL+"/download")
			return
		}
		w.Write([]byte(`{"starred_sessions": ["before", "after"]}`))
	}))
	defer gdrive.Close()

	config.Google.Drive.FilesURL = gdrive.URL + "/list"
	config.Google.Drive.Filename = "user_data.json"

	c := newContext(newTestRequest(t, "GET", "/dummy", nil))

	if err := storeCredentials(c, &oauth2Credentials{
		userID:      testUserID,
		Expiry:      time.Now().Add(2 * time.Hour),
		AccessToken: "access-token",
	}); err != nil {
		t.Fatal(err)
	}
	if err := storeUserPushInfo(c, &userPush{userID: testUserID}); err != nil {
		t.Fatal(err)
	}

	swToken := fetchFirstSWToken(t, testIDToken)
	_, swTime, err := decodeSWToken(swToken)
	if err != nil {
		t.Fatal(err)
	}
	timeBefore, timeAfter := swTime.AddDate(0, 0, -1), swTime.AddDate(0, 0, 1)
	swTokenBefore, _ := encodeSWToken(testUserID, timeBefore.Add(-1*time.Second))
	swTokenAfter, _ := encodeSWToken(testUserID, timeAfter)

	if err = storeChanges(c, &dataChanges{
		Updated: timeBefore,
		eventData: eventData{
			Sessions: map[string]*eventSession{
				"before": &eventSession{Update: updateDetails},
			},
		},
	}); err != nil {
		t.Fatal(err)
	}
	if err = storeChanges(c, &dataChanges{
		Updated: timeAfter,
		eventData: eventData{
			Sessions: map[string]*eventSession{
				"after":     &eventSession{Update: updateDetails},
				"unrelated": &eventSession{Update: updateDetails},
			},
		},
	}); err != nil {
		t.Fatal(err)
	}

	table := []struct {
		token    string
		sessions []string
		updated  time.Time
		next     time.Time
	}{
		{swToken, []string{"after"}, timeAfter, timeAfter.Add(1 * time.Second)},
		{swTokenBefore, []string{"before", "after"}, timeAfter, timeAfter.Add(1 * time.Second)},
		{swTokenAfter, []string{}, timeAfter, timeAfter.Add(1 * time.Second)},
	}

	for i, test := range table {
		r := newTestRequest(t, "GET", "/api/v1/user/updates", nil)
		r.Header.Set("authorization", test.token)
		w := httptest.NewRecorder()
		serveUserUpdates(w, r)

		if w.Code != http.StatusOK {
			t.Errorf("%d: w.Code = %d; want 200\nResponse: %s", i, w.Code, w.Body.String())
		}

		res := &dataChanges{}
		if err := json.Unmarshal(w.Body.Bytes(), res); err != nil {
			t.Errorf("%d: json.Unmarshal: %v", i, err)
			continue
		}
		if res.Updated.Unix() != test.updated.Unix() {
			t.Errorf("%d: res.Updated = %s; want %s", i, res.Updated, test.updated)
		}
		if len(res.Sessions) != len(test.sessions) {
			t.Errorf("%d: len(res.Sessions) = %d; want %d", i, len(res.Sessions), len(test.sessions))
		}
		for _, id := range test.sessions {
			s, ok := res.Sessions[id]
			if !ok {
				t.Errorf("%d: want session %q", i, id)
				break
			}
			if s.Update != updateDetails {
				t.Errorf("%d: res.Sessions[%q].Update = %q; want %q", i, id, s.Update, updateDetails)
			}
		}
		user, next, err := decodeSWToken(res.Token)
		if err != nil {
			t.Errorf("%d: decodeSWToken(%q): %v", i, res.Token, err)
		}
		if user != testUserID {
			t.Errorf("%d: user = %q; want %q", i, user, testUserID)
		}
		if next.Unix() != test.next.Unix() {
			t.Errorf("%d: next = %s; want %s", i, next, test.next)
		}
	}
}

func TestHandlePingExt(t *testing.T) {
	defer resetTestState(t)
	defer preserveConfig()()

	done := make(chan struct{}, 1)
	ping := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() { done <- struct{}{} }()
		if ah := r.Header.Get("Authorization"); ah != "key=a-key" {
			t.Errorf("ah = %q; want 'a-key'", ah)
		}
		var body map[string]interface{}
		d := json.NewDecoder(r.Body)
		d.UseNumber()
		if err := d.Decode(&body); err != nil {
			t.Error(err)
		}
		v, ok := body["sync_jitter"].(json.Number)
		if !ok {
			t.Errorf("body: %+v, sync_jitter: %v (%T); want json.Number", body, v, body["sync_jitter"])
			return
		}
		if n, err := v.Int64(); n != 0 {
			t.Errorf("v.Int64() = %d, %v; want 0", n, err)
		}
	}))
	defer ping.Close()
	config.ExtPingURL = ping.URL

	r := newTestRequest(t, "POST", "/task/ping-ext?key=a-key", nil)
	r.Header.Set("x-appengine-taskexecutioncount", "1")
	w := httptest.NewRecorder()
	handlePingExt(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("w.Code = %d; want 200", w.Code)
	}

	select {
	case <-done:
		// passed
	default:
		t.Errorf("ping never happened")
	}
}

func TestHandlePingUserUpgradeSubscribers(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	config.Google.GCM.Endpoint = "http://gcm"
	r := newTestRequest(t, "POST", "/task/ping-user", nil)
	r.Form = url.Values{
		"uid":      {testUserID},
		"sessions": {"s-123"},
	}
	r.Header.Set("x-appengine-taskexecutioncount", "1")
	c := newContext(r)

	if err := storeUserPushInfo(c, &userPush{
		userID:      testUserID,
		Subscribers: []string{"gcm-1", "gcm-2"},
		Endpoints:   []string{"http://gcm", "http://gcm/gcm-2", "http://push/endpoint"},
	}); err != nil {
		t.Fatal(err)
	}

	w := httptest.NewRecorder()
	handlePingUser(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("w.Code = %d; want 200", w.Code)
	}

	pi, err := getUserPushInfo(c, testUserID)
	if err != nil {
		t.Fatal(err)
	}
	if len(pi.Subscribers) != 0 {
		t.Errorf("pi.Subscribers = %v; want []", pi.Subscribers)
	}
	endpoints := []string{"http://gcm/gcm-1", "http://gcm/gcm-2", "http://push/endpoint"}
	if !reflect.DeepEqual(pi.Endpoints, endpoints) {
		t.Errorf("pi.Endpoints = %v; want %v", pi.Endpoints, endpoints)
	}
}

func TestHandlePingUserMissingToken(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	// just in case a request breaks out
	config.Google.TokenURL = "http://token-should-not-be-used/"
	config.Google.Drive.FilesURL = "http://drive-should-not-be-used/"

	r := newTestRequest(t, "POST", "/task/ping-user", nil)
	r.Form = url.Values{
		"uid":      {testUserID},
		"sessions": {"one"},
	}
	r.Header.Set("x-appengine-taskexecutioncount", "1")
	c := newContext(r)

	if err := storeUserPushInfo(c, &userPush{userID: testUserID, Enabled: true}); err != nil {
		t.Fatal(err)
	}
	if err := storeCredentials(c, &oauth2Credentials{
		userID:       testUserID,
		Expiry:       time.Now(),
		AccessToken:  "dummy-access",
		RefreshToken: "",
	}); err != nil {
		t.Fatal(err)
	}

	w := httptest.NewRecorder()
	handlePingUser(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("w.Code = %d; want 200\nResponse: %s", w.Code, w.Body.String())
	}
}

func TestHandlePingUserRefokedToken(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	r := newTestRequest(t, "POST", "/task/ping-user", nil)
	r.Form = url.Values{
		"uid":      {testUserID},
		"sessions": {"one"},
	}
	r.Header.Set("x-appengine-taskexecutioncount", "1")
	c := newContext(r)

	if err := storeUserPushInfo(c, &userPush{userID: testUserID, Enabled: true}); err != nil {
		t.Fatal(err)
	}
	if err := storeCredentials(c, &oauth2Credentials{
		userID:       testUserID,
		Expiry:       time.Now(),
		AccessToken:  "dummy-access",
		RefreshToken: "revoked",
	}); err != nil {
		t.Fatal(err)
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(`{"error": "invalid_grant"}`))
	}))
	defer ts.Close()
	config.Google.TokenURL = ts.URL
	config.Google.Drive.FilesURL = "http://example.org/"

	w := httptest.NewRecorder()
	handlePingUser(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("w.Code = %d; want 200\nResponse: %s", w.Code, w.Body.String())
	}
}

func TestHandlePingDeviceGCM(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	count := 0
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if ah := r.Header.Get("authorization"); ah != "key=test-key" {
			t.Errorf("ah = %q; want 'key=test-key'", ah)
		}
		if reg := r.FormValue("registration_id"); reg != "reg-123" {
			t.Errorf("reg = %q; want 'reg-123'", reg)
		}
		fmt.Fprintf(w, "id=message-id-123")
		count += 1
	}))
	defer ts.Close()

	config.Google.GCM.Key = "test-key"
	config.Google.GCM.Endpoint = ts.URL
	endpoint := ts.URL + "/reg-123"

	r := newTestRequest(t, "POST", "/task/ping-device", nil)
	r.Form = url.Values{
		"uid":      {testUserID},
		"endpoint": {endpoint},
	}
	r.Header.Set("x-appengine-taskexecutioncount", "1")

	c := newContext(r)
	if err := storeUserPushInfo(c, &userPush{
		userID:    testUserID,
		Enabled:   true,
		Endpoints: []string{endpoint},
	}); err != nil {
		t.Fatal(err)
	}

	w := httptest.NewRecorder()
	handlePingDevice(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("w.Code = %d; want 200", w.Code)
	}
	if count != 1 {
		t.Errorf("req count = %d; want 1", count)
	}
	pi, err := getUserPushInfo(c, testUserID)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(pi.Endpoints, []string{endpoint}) {
		t.Errorf("pi.Endpoints = %v; want [%q]", pi.Endpoints, endpoint)
	}
}

func TestHandlePingDeviceGCMDelete(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	// GCM server
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Error=NotRegistered")
	}))
	defer ts.Close()
	config.Google.GCM.Endpoint = ts.URL

	r := newTestRequest(t, "POST", "/task/ping-device", nil)
	r.Form = url.Values{
		"uid":      {testUserID},
		"endpoint": {ts.URL + "/reg-123"},
	}
	r.Header.Set("x-appengine-taskexecutioncount", "1")

	c := newContext(r)
	storeUserPushInfo(c, &userPush{
		userID:    testUserID,
		Enabled:   true,
		Endpoints: []string{ts.URL + "/reg-123"},
	})

	w := httptest.NewRecorder()
	handlePingDevice(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("w.Code = %d; want 200", w.Code)
	}

	pi, err := getUserPushInfo(c, testUserID)
	if err != nil {
		t.Fatal(err)
	}
	if len(pi.Subscribers) != 0 || len(pi.Endpoints) != 0 {
		t.Errorf("pi.Subscrbers=%v pi.Endpoints=%v; want []", pi.Subscribers, pi.Endpoints)
	}
}

func TestHandlePingDeviceGCMReplace(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	// GCM server
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "id=msg-id&registration_id=new-reg-id")
	}))
	defer ts.Close()
	config.Google.GCM.Endpoint = ts.URL

	r := newTestRequest(t, "POST", "/task/ping-device", nil)
	r.Form = url.Values{
		"uid":      {testUserID},
		"endpoint": {ts.URL + "/reg-123"},
	}
	r.Header.Set("x-appengine-taskexecutioncount", "1")

	c := newContext(r)
	storeUserPushInfo(c, &userPush{
		userID:    testUserID,
		Enabled:   true,
		Endpoints: []string{ts.URL + "/reg-123"},
	})

	w := httptest.NewRecorder()
	handlePingDevice(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("w.Code = %d; want 200", w.Code)
	}

	pi, err := getUserPushInfo(c, testUserID)
	if err != nil {
		t.Fatal(err)
	}
	if v := []string{ts.URL + "/new-reg-id"}; !reflect.DeepEqual(pi.Endpoints, v) {
		t.Errorf("pi.Endpoints = %v; want %v", pi.Endpoints, v)
	}
	if l := len(pi.Subscribers); l != 0 {
		t.Errorf("len(pi.Subscribers) = %d; want 0", l)
	}
}

func TestHandlePingDevice(t *testing.T) {
	defer resetTestState(t)
	defer preserveConfig()()

	count := 0
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if ah := r.Header.Get("authorization"); ah != "" {
			t.Errorf("ah = %q; want ''", ah)
		}
		w.WriteHeader(http.StatusOK)
		count += 1
	}))
	defer ts.Close()

	r := newTestRequest(t, "POST", "/task/ping-device", nil)
	r.Form = url.Values{
		"uid":      {testUserID},
		"endpoint": {ts.URL + "/reg-123"},
	}
	r.Header.Set("x-appengine-taskexecutioncount", "1")
	w := httptest.NewRecorder()
	handlePingDevice(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("w.Code = %d; want 200", w.Code)
	}
	if count != 1 {
		t.Errorf("req count = %d; want 1", count)
	}
}

func TestHandlePingDeviceDelete(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	// a push server
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusGone)
	}))
	defer ts.Close()

	r := newTestRequest(t, "POST", "/task/ping-device", nil)
	r.Form = url.Values{
		"uid":      {testUserID},
		"endpoint": {ts.URL + "/reg-123"},
	}
	r.Header.Set("x-appengine-taskexecutioncount", "1")

	c := newContext(r)
	storeUserPushInfo(c, &userPush{
		userID:    testUserID,
		Enabled:   true,
		Endpoints: []string{"http://one", ts.URL + "/reg-123", "http://two"},
	})

	w := httptest.NewRecorder()
	handlePingDevice(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("w.Code = %d; want 200", w.Code)
	}

	pi, err := getUserPushInfo(c, testUserID)
	if err != nil {
		t.Fatal(err)
	}
	endpoints := []string{"http://one", "http://two"}
	if !reflect.DeepEqual(pi.Endpoints, endpoints) {
		t.Errorf("pi.Endpoints=%v; want %v", pi.Endpoints, endpoints)
	}
}

func TestHandleClockNextSessions(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	now := time.Now()
	swToken := fetchFirstSWToken(t, testIDToken)
	if swToken == "" {
		t.Fatal("no swToken")
	}

	// gdrive stub
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/file-id" {
			w.Write([]byte(`{"starred_sessions": ["start", "__keynote__", "too-early"]}`))
			return
		}
		fmt.Fprintf(w, `{"items": [{
			"id": "file-id",
			"modifiedDate": "2015-04-11T12:12:46.034Z"
		}]}`)
	}))
	defer ts.Close()
	config.Google.Drive.FilesURL = ts.URL + "/"
	config.Google.Drive.Filename = "user_data.json"

	c := newContext(newTestRequest(t, "GET", "/", nil))
	if err := storeCredentials(c, &oauth2Credentials{
		userID:      testUserID,
		Expiry:      time.Now().Add(2 * time.Hour),
		AccessToken: "access-token",
	}); err != nil {
		t.Fatal(err)
	}
	if err := storeUserPushInfo(c, &userPush{userID: testUserID}); err != nil {
		t.Fatal(err)
	}
	if err := storeNextSessions(c, []*eventSession{
		&eventSession{Id: "already-clocked", Update: updateStart},
	}); err != nil {
		t.Fatal(err)
	}
	if err := storeEventData(c, &eventData{Sessions: map[string]*eventSession{
		"start": &eventSession{
			Id:        "start",
			StartTime: now.Add(timeoutStart - time.Second),
		},
		"__keynote__": &eventSession{
			Id:        "__keynote__",
			StartTime: now.Add(timeoutSoon - time.Second),
		},
		"already-clocked": &eventSession{
			Id:        "already-clocked",
			StartTime: now.Add(timeoutStart - time.Second),
		},
		"too-early": &eventSession{ // because it's not in soonSessionIDs
			Id:        "too-early",
			StartTime: now.Add(timeoutSoon - time.Second),
		},
	}}); err != nil {
		t.Fatal(err)
	}

	upsess := map[string]string{
		"start":       updateStart,
		"__keynote__": updateSoon,
	}
	checkUpdates := func(dc *dataChanges, what string) {
		if len(dc.Sessions) != len(upsess) {
			t.Errorf("%s: dc.Sessions = %v; want %v", what, dc.Sessions, upsess)
		}
		for id, v := range upsess {
			s, ok := dc.Sessions[id]
			if !ok {
				t.Errorf("%s: %q not in %v", what, id, dc.Sessions)
				continue
			}
			if s.Update != v {
				t.Errorf("%s: s.Update = %q; want %q", what, s.Update, v)
			}
		}
	}

	r := newTestRequest(t, "POST", "/task/clock", nil)
	r.Header.Set("x-appengine-cron", "true")
	w := httptest.NewRecorder()
	handleClock(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("w.Code = %d; want 200", w.Code)
	}

	unclocked, err := filterNextSessions(c, []*eventSession{
		&eventSession{Id: "__keynote__", Update: updateSoon},
		&eventSession{Id: "start", Update: updateStart},
		&eventSession{Id: "too-early", Update: "too-early"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(unclocked) != 1 {
		t.Fatalf("unclocked = %v; want [too-early]", toSessionIDs(unclocked))
	}
	if unclocked[0].Id != "too-early" {
		t.Fatalf("Id = %q; want 'too-early'", unclocked[0].Id)
	}

	dc, err := getChangesSince(c, now.Add(-time.Second))
	if err != nil {
		t.Fatal(err)
	}
	checkUpdates(dc, "getChangesSince")

	r = newTestRequest(t, "GET", "/api/v1/user/updates", nil)
	r.Header.Set("authorization", swToken)
	w = httptest.NewRecorder()
	serveUserUpdates(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("w.Code = %d; want 200\nResponse: %s", w.Code, w.Body.String())
	}
	dc = &dataChanges{}
	if err := json.Unmarshal(w.Body.Bytes(), dc); err != nil {
		t.Fatal(err)
	}
	checkUpdates(dc, "api")
}

func TestHandleClockSurvey(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	now := time.Now()
	swToken := fetchFirstSWToken(t, testIDToken)
	if swToken == "" {
		t.Fatal("no swToken")
	}

	// gdrive stub
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/file-id" {
			w.Write([]byte(`{"starred_sessions": ["random"]}`))
			return
		}
		fmt.Fprintf(w, `{"items": [{
			"id": "file-id",
			"modifiedDate": "2015-04-11T12:12:46.034Z"
		}]}`)
	}))
	defer ts.Close()
	config.Google.Drive.FilesURL = ts.URL + "/"
	config.Google.Drive.Filename = "user_data.json"

	c := newContext(newTestRequest(t, "GET", "/", nil))
	if err := storeCredentials(c, &oauth2Credentials{
		userID:      testUserID,
		Expiry:      time.Now().Add(2 * time.Hour),
		AccessToken: "access-token",
	}); err != nil {
		t.Fatal(err)
	}
	if err := storeUserPushInfo(c, &userPush{userID: testUserID}); err != nil {
		t.Fatal(err)
	}
	if err := storeNextSessions(c, []*eventSession{
		&eventSession{Id: "__keynote__", Update: updateSoon},
		&eventSession{Id: "__keynote__", Update: updateStart},
	}); err != nil {
		t.Fatal(err)
	}
	if err := storeEventData(c, &eventData{Sessions: map[string]*eventSession{
		"random": &eventSession{
			Id:        "random",
			StartTime: now.Add(-timeoutSurvey - time.Minute),
		},
		"__keynote__": &eventSession{
			Id:        "__keynote__",
			StartTime: now.Add(-timeoutSurvey - time.Minute),
		},
	}}); err != nil {
		t.Fatal(err)
	}

	upsess := map[string]string{
		"__keynote__": updateSurvey,
	}
	checkUpdates := func(dc *dataChanges, what string) {
		if len(dc.Sessions) != len(upsess) {
			t.Errorf("%s: dc.Sessions = %v; want %v", what, dc.Sessions, upsess)
		}
		for id, v := range upsess {
			s, ok := dc.Sessions[id]
			if !ok {
				t.Errorf("%s: %q not in %v", what, id, dc.Sessions)
				continue
			}
			if s.Update != v {
				t.Errorf("%s: s.Update = %q; want %q", what, s.Update, v)
			}
		}
	}

	r := newTestRequest(t, "POST", "/task/clock", nil)
	r.Header.Set("x-appengine-cron", "true")
	w := httptest.NewRecorder()
	handleClock(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("w.Code = %d; want 200", w.Code)
	}

	unclocked, err := filterNextSessions(c, []*eventSession{
		&eventSession{Id: "__keynote__", Update: updateSurvey},
		&eventSession{Id: "random", Update: updateSurvey},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(unclocked) != 1 {
		t.Fatalf("unclocked = %v; want [random]", toSessionIDs(unclocked))
	}
	if unclocked[0].Id != "random" {
		t.Fatalf("Id = %q; want 'random'", unclocked[0].Id)
	}

	dc, err := getChangesSince(c, now.Add(-time.Second))
	if err != nil {
		t.Fatal(err)
	}
	checkUpdates(dc, "getChangesSince")

	r = newTestRequest(t, "GET", "/api/v1/user/updates", nil)
	r.Header.Set("authorization", swToken)
	w = httptest.NewRecorder()
	serveUserUpdates(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("w.Code = %d; want 200\nResponse: %s", w.Code, w.Body.String())
	}
	dc = &dataChanges{}
	if err := json.Unmarshal(w.Body.Bytes(), dc); err != nil {
		t.Fatal(err)
	}
	checkUpdates(dc, "api")
}

func TestHandleEasterEgg(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	const link = "http://example.org/egg"
	config.SyncToken = "secret"

	table := []struct {
		inLink  string
		expires time.Time
		auth    string
		code    int
		outLink string
	}{
		{link, time.Now().Add(10 * time.Minute), config.SyncToken, http.StatusOK, link},
		{link, time.Now().Add(-10 * time.Minute), config.SyncToken, http.StatusOK, ""},
		{link, time.Now().Add(time.Minute), "invalid", http.StatusForbidden, ""},
		{link, time.Now().Add(time.Minute), "", http.StatusForbidden, ""},
	}

	for i, test := range table {
		body := fmt.Sprintf(`{
			"link": %q,
			"expires": %q
		}`, test.inLink, test.expires.Format(time.RFC3339))
		r := newTestRequest(t, "POST", "/api/v1/easter-egg", strings.NewReader(body))
		r.Header.Set("authorization", test.auth)
		w := httptest.NewRecorder()
		handleEasterEgg(w, r)

		if w.Code != test.code {
			t.Errorf("%d: w.Code = %d; want %d\nResponse: %s", i, w.Code, test.code, w.Body.String())
		}
		if test.code != http.StatusOK {
			continue
		}
		c := newContext(r)
		if err := cache.flush(c); err != nil {
			t.Error(err)
			continue
		}
		link := getEasterEggLink(c)
		if link != test.outLink {
			t.Errorf("%d: link = %q; want %q", i, link, test.outLink)
		}
	}
}

func fetchFirstSWToken(t *testing.T, auth string) string {
	r := newTestRequest(t, "GET", "/api/v1/user/updates", nil)
	r.Header.Set("authorization", bearerHeader+auth)
	w := httptest.NewRecorder()
	serveSWToken(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("w.Code = %d; want 200")
	}
	var sw struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &sw); err != nil {
		t.Fatal(err)
	}
	return sw.Token
}

func compareStringSlices(a, b []string) bool {
	sort.Strings(a)
	sort.Strings(b)
	return reflect.DeepEqual(a, b)
}
