package main

import (
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"golang.org/x/net/context"
)

func TestServeIOExtEntriesStub(t *testing.T) {
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

func TestServeTemplate(t *testing.T) {
	const ctype = "text/html;charset=utf-8"

	revert := preserveConfig()
	defer revert()
	config.Prefix = "/root"

	table := []struct{ path, slug, canonical string }{
		{"/", "home", "/root/"},
		{"/home?experiment", "home", "/root/"},
		{"/about", "about", "/root/about"},
		{"/about?experiment", "about", "/root/about"},
		{"/schedule", "schedule", "/root/schedule"},
		{"/onsite", "onsite", "/root/onsite"},
		{"/offsite", "offsite", "/root/offsite"},
		{"/registration", "registration", "/root/registration"},
		{"/faq", "faq", "/root/faq"},
		{"/form", "form", "/root/form"},
	}
	for i, test := range table {
		r := newTestRequest(t, "GET", test.path, nil)
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

func TestHandleAuth(t *testing.T) {
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

		c = context.WithValue(c, ctxKeyUser, testUserID)
		cred, err := getCredentials(c)

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

func TestServeUserSchedule(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer preserveConfig()()

	checkAutHeader := func(who, ah string) {
		if ah == "" || !strings.HasPrefix(strings.ToLower(ah), "bearer ") {
			t.Errorf("%s: bad authorization header: %q", who, ah)
		} else if ah = ah[7:]; ah != "dummy-access" {
			t.Errorf("%s: authorization = %q; want dummy-access", who, ah)
		}
	}

	// drive download file server
	down := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		checkAutHeader("down", r.Header.Get("authorization"))
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"starred_sessions": ["dummy-session-id"]}`))
	}))
	defer down.Close()

	// drive search files server
	files := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		checkAutHeader("files", r.Header.Get("authorization"))
		q := "'appfolder' in parents and title = 'user_data.json' and trashed = false"
		if v := r.FormValue("q"); v != q {
			t.Errorf("q = %q; want %q", v, q)
		}

		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"items": [
      {
        "id": "not-this-one",
        "modifiedDate": "2015-04-10T12:12:46.034Z",
        "downloadUrl": "http://not-this-url"
      },
      {
        "id": "file-id",
        "modifiedDate": "2015-04-11T12:12:46.034Z",
        "downloadUrl": %q
      }
    ]}`, down.URL)
	}))
	defer files.Close()

	config.Google.Drive.FilesURL = files.URL + "/"
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
	r := newTestRequest(t, "GET", "/api/v1/user/schedule", nil)
	r.Header.Set("Authorization", "Bearer "+testIDToken)

	serveUserSchedule(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("w.Code = %d; want 200", w.Code)
	}
	var list []string
	if err := json.Unmarshal(w.Body.Bytes(), &list); err != nil {
		t.Fatalf("json.Unmarshal: %v\nResponse: %s", err, w.Body.String())
	}
	if len(list) != 1 || list[0] != "dummy-session-id" {
		t.Errorf("list = %v; want ['dummy-session-id']", list)
	}
}

func TestHandleUserSchedulePut(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
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

	checkMedia := func(r io.Reader) {
		var data appFolderData
		if err := json.NewDecoder(r).Decode(&data); err != nil {
			t.Errorf("checkMedia: %v", err)
			return
		}
		if len(data.Bookmarks) != 1 || data.Bookmarks[0] != "new-session-id" {
			t.Errorf("checkMedia: data.Bookmarks = %v; want ['new-session-id']", data.Bookmarks)
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
	r := newTestRequest(t, "PUT", "/api/v1/user/schedule/new-session-id", nil)
	r.Header.Set("Authorization", "Bearer "+testIDToken)

	handleUserBookmarks(w, r)

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
	if len(list) != 1 || list[0] != "new-session-id" {
		t.Errorf("list = %v; want ['new-session-id']", list)
	}
}

func TestHandleUserScheduleDelete(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer preserveConfig()()

	// drive download file server
	down := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"starred_sessions": ["one-session", "two-session"]}`))
	}))
	defer down.Close()

	// drive search files server
	files := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := "'appfolder' in parents and title = 'user_data.json' and trashed = false"
		if v := r.FormValue("q"); v != q {
			t.Errorf("q = %q; want %q", v, q)
		}

		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"items": [{
      "id": "file-id",
      "modifiedDate": "2015-04-11T12:12:46.034Z",
      "downloadUrl": %q
    }]}`, down.URL)
	}))
	defer files.Close()

	// drive upload server
	upload := make(chan struct{}, 1)
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() { upload <- struct{}{} }()

		_, params, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if err != nil {
			t.Fatalf("mime.ParseMediaType: %v", err)
		}

		mr := multipart.NewReader(r.Body, params["boundary"])
		if _, err := mr.NextPart(); err != nil {
			t.Fatalf("0: mr.NextPart: %v", err)
		}

		p, err := mr.NextPart()
		if err != nil {
			t.Fatalf("1: mr.NextPart: %v", err)
		}
		var data appFolderData
		if err := json.NewDecoder(p).Decode(&data); err != nil {
			t.Fatalf("Decode(mr.NextPart): %v", err)
		}
		if len(data.Bookmarks) != 1 || data.Bookmarks[0] != "two-session" {
			t.Errorf("data.Bookmarks = %v; want ['two-session']", data.Bookmarks)
		}
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
	r := newTestRequest(t, "DELETE", "/api/v1/user/schedule/one-session", nil)
	r.Header.Set("Authorization", "Bearer "+testIDToken)

	handleUserBookmarks(w, r)

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
}
