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
	"fmt"
	"html/template"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"golang.org/x/net/context"
)

const (
	// maxTaskRetry is the default max number of a task retries.
	maxTaskRetry = 10
	// syncGCSCacheKey guards GCS sync task against choking
	// when requests coming too fast.
	syncGCSCacheKey = "sync:gcs"
)

var (
	// wrapHandler is the last in a handler chain call,
	// which wraps all app handlers.
	// GAE and standalone servers have different wrappers, hence a variable.
	wrapHandler func(http.Handler) http.Handler
	// rootHandleFn is a request handler func for config.Prefix pattern.
	// GAE and standalone servers have different root handle func.
	rootHandleFn func(http.ResponseWriter, *http.Request)
)

// registerHandlers sets up all backend handle funcs, including the API.
func registerHandlers() {
	// HTML and other non-API
	handle("/", rootHandleFn)
	handle("/sitemap.xml", serveSitemap)
	handle("/manifest.json", serveManifest)
	// API v0 - pre-phase2
	handle("/api/extended", serveIOExtEntries)
	handle("/api/social", serveSocial)
	// API v1
	handle("/api/v1/extended", serveIOExtEntries)
	handle("/api/v1/social", serveSocial)
	handle("/api/v1/auth", handleAuth)
	handle("/api/v1/schedule", serveSchedule)
	handle("/api/v1/easter-egg", handleEasterEgg)
	handle("/api/v1/photoproxy", servePhotosProxy)
	handle("/api/v1/user/schedule", handleUserSchedule)
	handle("/api/v1/user/schedule/", handleUserSchedule)
	handle("/api/v1/user/notify", handleUserNotifySettings)
	handle("/api/v1/user/updates", serveUserUpdates)
	handle("/api/v1/user/survey", handleUserSurvey)
	handle("/api/v1/user/survey/", handleUserSurvey)
	// API v2
	handle("/api/v2/user/notify", handleUserNotifySettings)
	// background jobs
	handle("/sync/gcs", syncEventData)
	handle("/task/notify-subscribers", handleNotifySubscribers)
	handle("/task/ping-user", handlePingUser)
	handle("/task/ping-device", handlePingDevice)
	handle("/task/ping-ext", handlePingExt)
	handle("/task/clock", handleClock)
	// debug handlers; not available in prod
	if !isProd() {
		handle("/debug/srvget", debugServiceGetURL)
		handle("/debug/push", debugPush)
		handle("/debug/sync", debugSync)
	}
	// setup root redirect if we're prefixed
	if config.Prefix != "/" {
		var redirect http.Handler = http.HandlerFunc(redirectHandler)
		if wrapHandler != nil {
			redirect = wrapHandler(redirect)
		}
		http.Handle("/", redirect)
	}
	// warmup, can't use prefix
	http.HandleFunc("/_ah/warmup", func(w http.ResponseWriter, r *http.Request) {
		c := newContext(r)
		logf(c, "warmup: env = %s; devserver? %v", config.Env, isDevServer())
	})
}

// handle registers a handle function fn for the pattern prefixed
// with httpPrefix.
func handle(pattern string, fn func(w http.ResponseWriter, r *http.Request)) {
	p := path.Join(config.Prefix, pattern)
	if pattern[len(pattern)-1] == '/' {
		p += "/"
	}
	http.Handle(p, handler(fn))
}

// handler creates a new func from fn with stripped prefix
// and wrapped with wrapHandler.
func handler(fn func(w http.ResponseWriter, r *http.Request)) http.Handler {
	var h http.Handler = http.HandlerFunc(fn)
	if config.Prefix != "/" {
		h = http.StripPrefix(config.Prefix, h)
	}
	if wrapHandler != nil {
		h = wrapHandler(h)
	}
	return h
}

// redirectHandler redirects from a /page path to /httpPrefix/page
// It returns 404 Not Found error for any other requested asset.
func redirectHandler(w http.ResponseWriter, r *http.Request) {
	if ext := filepath.Ext(r.URL.Path); ext != "" {
		code := http.StatusNotFound
		http.Error(w, http.StatusText(code), code)
		return
	}
	http.Redirect(w, r, path.Join(config.Prefix, r.URL.Path), http.StatusFound)
}

// serveTemplate responds with text/html content of the executed template
// found under the request path. 'home' template is used if the request path is /.
// It also redirects requests with a trailing / to the same path w/o it.
func serveTemplate(w http.ResponseWriter, r *http.Request) {
	// redirect /page/ to /page unless it's homepage
	if r.URL.Path != "/" && strings.HasSuffix(r.URL.Path, "/") {
		trimmed := path.Join(config.Prefix, strings.TrimSuffix(r.URL.Path, "/"))
		http.Redirect(w, r, trimmed, http.StatusFound)
		return
	}

	c := newContext(r)
	r.ParseForm()
	_, wantsPartial := r.Form["partial"]
	_, experimentShare := r.Form["experiment"]

	tplname := strings.TrimPrefix(r.URL.Path, "/")
	if tplname == "" {
		tplname = "home"
	}

	// TODO: move all template-related stuff to template.go
	data := &templateData{Canonical: canonicalURL(r, nil)}
	switch {
	case experimentShare:
		data.OgTitle = defaultTitle
		data.OgImage = ogImageExperiment
		data.Desc = descExperiment
	case !wantsPartial && r.URL.Path == "/schedule":
		sid := r.FormValue("sid")
		if sid == "" {
			break
		}
		s, err := getSessionByID(c, sid)
		if err != nil {
			break
		}
		data.Canonical = canonicalURL(r, url.Values{"sid": {sid}})
		data.Title = s.Title + " - Google I/O Schedule"
		data.OgTitle = data.Title
		data.OgImage = s.Photo
		data.Desc = s.Desc
	}

	w.Header().Set("Content-Type", "text/html;charset=utf-8")
	if !isDevServer() {
		w.Header().Set("Content-Security-Policy", "upgrade-insecure-requests")
	}

	b, err := renderTemplate(c, tplname, wantsPartial, data)
	if err == nil {
		w.Header().Set("Cache-Control", "public, max-age=300")
		w.Write(b)
		return
	}

	errorf(c, "renderTemplate(%q): %v", tplname, err)
	switch err.(type) {
	case *os.PathError:
		w.WriteHeader(http.StatusNotFound)
		tplname = "error_404"
	default:
		w.WriteHeader(http.StatusInternalServerError)
		tplname = "error_500"
	}
	if b, err = renderTemplate(c, tplname, false, nil); err == nil {
		w.Write(b)
	} else {
		errorf(c, "renderTemplate(%q): %v", tplname, err)
	}
}

// serveSitemap responds with sitemap XML entries for a better SEO.
func serveSitemap(w http.ResponseWriter, r *http.Request) {
	c := newContext(r)
	base := &url.URL{
		Scheme: "https",
		Host:   r.Host,
		Path:   config.Prefix + "/",
	}
	if r.TLS == nil {
		base.Scheme = "http"
	}
	m, err := getSitemap(c, base)
	if err != nil {
		writeError(w, err)
		return
	}
	res, err := xml.MarshalIndent(m, "  ", "    ")
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("content-type", "application/xml")
	w.Write(res)
}

// serveSitemap responds with app manifest.
func serveManifest(w http.ResponseWriter, r *http.Request) {
	m, err := renderManifest()
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("content-type", "application/manifest+json")
	w.Write(m)
}

// serveIOExtEntries responds with I/O extended entries in JSON format.
// See extEntry struct definition for more details.
func serveIOExtEntries(w http.ResponseWriter, r *http.Request) {
	r.ParseForm()
	_, refresh := r.Form["refresh"]

	c := newContext(r)
	w.Header().Set("Cache-Control", "public, max-age=60")
	w.Header().Set("Content-Type", "application/json;charset=utf-8")

	// respond with stubbed JSON entries in dev mode
	if isDev() {
		f := filepath.Join(config.Dir, "temporary_api", "ioext_feed.json")
		http.ServeFile(w, r, f)
		return
	}

	entries, err := ioExtEntries(c, refresh)
	if err != nil {
		errorf(c, "ioExtEntries: %v", err)
		writeJSONError(c, w, http.StatusInternalServerError, err)
		return
	}

	body, err := json.Marshal(entries)
	if err != nil {
		errorf(c, "json.Marshal: %v", err)
		writeJSONError(c, w, http.StatusInternalServerError, err)
		return
	}

	if _, err := w.Write(body); err != nil {
		errorf(c, "w.Write: %v", err)
	}
}

// serveSocial responds with 10 most recent tweets.
// See socEntry struct for fields format.
func serveSocial(w http.ResponseWriter, r *http.Request) {
	r.ParseForm()
	_, refresh := r.Form["refresh"]

	c := newContext(r)
	w.Header().Set("Cache-Control", "public, max-age=60")
	w.Header().Set("Content-Type", "application/json;charset=utf-8")

	// respond with stubbed JSON entries in dev mode
	if isDev() {
		f := filepath.Join(config.Dir, "temporary_api", "social_feed.json")
		http.ServeFile(w, r, f)
		return
	}

	entries, err := socialEntries(c, refresh)
	if err != nil {
		errorf(c, "socialEntries: %v", err)
		writeJSONError(c, w, http.StatusInternalServerError, err)
		return
	}

	body, err := json.Marshal(entries)
	if err != nil {
		errorf(c, "json.Marshal: %v", err)
		writeJSONError(c, w, http.StatusInternalServerError, err)
		return
	}

	if _, err := w.Write(body); err != nil {
		errorf(c, "w.Write: %v", err)
	}
}

// handleAuth is the main authentication handler.
// It expects the following request header and body:
//
//     Authorization: Bearer <ID or access token>
//     Content-Type: application/json
//     {"code": "one-time authorization code from hybrid server-side flow"}
//
// which will result in a 200 OK empty response upon successful ID/access token
// and code verifications. The client can count it as "fully logged in" confirmation.
//
// ID token is prefered over access token.
func handleAuth(w http.ResponseWriter, r *http.Request) {
	// TODO: don't propagate error messages for security reasons
	w.Header().Set("Content-Type", "application/json;charset=utf-8")
	c := newContext(r)
	ah := r.Header.Get("authorization")

	c, err := authUser(c, ah)
	if err != nil {
		writeJSONError(c, w, errStatus(err), err)
		return
	}
	var flow struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&flow); err != nil {
		writeJSONError(c, w, http.StatusBadRequest, err)
		return
	}
	err = runInTransaction(c, func(c context.Context) error {
		creds, err := fetchCredentials(c, flow.Code)
		if err != nil {
			return err
		}
		return storeCredentials(c, creds)
	})
	if err != nil {
		writeJSONError(c, w, errStatus(err), err)
	}
}

func serveSchedule(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json;charset=utf-8")
	c := newContext(r)
	// respond with stubbed JSON entries in dev mode
	if isDev() {
		f := filepath.Join(config.Dir, "temporary_api", "schedule.json")
		fi, err := os.Stat(f)
		if err != nil {
			writeJSONError(c, w, errStatus(err), err)
			return
		}
		w.Header().Set("etag", fmt.Sprintf(`"%d-%d"`, fi.Size(), fi.ModTime().UnixNano()))
		http.ServeFile(w, r, f)
		return
	}

	data, err := getLatestEventData(c, r.Header["If-None-Match"])
	if err == errNotModified {
		w.Header().Set("etag", `"`+data.etag+`"`)
		w.WriteHeader(http.StatusNotModified)
		return
	}
	if err != nil {
		writeJSONError(c, w, errStatus(err), err)
		return
	}

	b, err := json.Marshal(toAPISchedule(data))
	if err != nil {
		writeJSONError(c, w, errStatus(err), err)
		return
	}
	w.Header().Set("etag", `"`+data.etag+`"`)
	w.Write(b)
}

func handleUserSchedule(w http.ResponseWriter, r *http.Request) {
	if r.Method == "GET" {
		serveUserSchedule(w, r)
		return
	}
	handleUserBookmarks(w, r)
}

func serveUserSchedule(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json;charset=utf-8")
	c, err := authUser(newContext(r), r.Header.Get("authorization"))
	if err != nil {
		writeJSONError(c, w, errStatus(err), err)
		return
	}

	bookmarks, err := userSchedule(c, contextUser(c))
	if err != nil {
		writeJSONError(c, w, http.StatusInternalServerError, err)
		return
	}
	if bookmarks == nil {
		bookmarks = []string{}
	}
	if err := json.NewEncoder(w).Encode(bookmarks); err != nil {
		errorf(c, "encode(%v): %v", bookmarks, err)
	}
}

func handleUserBookmarks(w http.ResponseWriter, r *http.Request) {
	if m := r.Header.Get("x-http-method-override"); m != "" {
		r.Method = strings.ToUpper(m)
	}
	w.Header().Set("Content-Type", "application/json;charset=utf-8")
	c, err := authUser(newContext(r), r.Header.Get("authorization"))
	if err != nil {
		writeJSONError(c, w, errStatus(err), err)
		return
	}
	user := contextUser(c)

	// get session IDs from either request body or URL path
	// the former has precedence
	var ids []string
	err = json.NewDecoder(r.Body).Decode(&ids)
	if err != nil || len(ids) == 0 {
		ids = []string{path.Base(r.URL.Path)}
	}
	for _, id := range ids {
		if id == "" || id == "schedule" {
			writeJSONError(c, w, http.StatusBadRequest, "invalid session ID")
			return
		}
		// TODO: check whether the session ID actually exists?
	}

	var bookmarks []string
	switch r.Method {
	case "PUT":
		bookmarks, err = bookmarkSessions(c, user, ids...)
	case "DELETE":
		bookmarks, err = unbookmarkSessions(c, user, ids...)
	default:
		writeJSONError(c, w, http.StatusBadRequest, "invalid request method")
		return
	}

	if err != nil {
		writeJSONError(c, w, http.StatusInternalServerError, err)
		return
	}

	if err := json.NewEncoder(w).Encode(bookmarks); err != nil {
		errorf(c, "handleUserBookmarks: encode(%v): %v", bookmarks, err)
	}
}

// handleUserNotifySettings calls either serves or patches user push config
// based on HTTP method of request r.
func handleUserNotifySettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		serveUserNotifySettings(w, r)
	case "PUT":
		patchUserNotifySettings(w, r)
	}
}

// serveUserNotifySettings responds with the current user push configuration.
func serveUserNotifySettings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json;charset=utf-8")
	c, err := authUser(newContext(r), r.Header.Get("authorization"))
	if err != nil {
		writeJSONError(c, w, errStatus(err), err)
		return
	}
	data, err := getUserPushInfo(c, contextUser(c))
	if err != nil {
		writeJSONError(c, w, errStatus(err), err)
		return
	}
	if err := json.NewEncoder(w).Encode(data); err != nil {
		errorf(c, "serveUserNotifySettings: %v", err)
	}
}

// patchUserNotifySettings updates user push configuration.
// It doesn't modify existing parameters not present in the payload of r.
func patchUserNotifySettings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json;charset=utf-8")
	c, err := authUser(newContext(r), r.Header.Get("authorization"))
	if err != nil {
		writeJSONError(c, w, errStatus(err), err)
		return
	}

	// decode request payload into a flexible map
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONError(c, w, http.StatusBadRequest, err)
		return
	}

	var data *userPush
	terr := runInTransaction(c, func(c context.Context) error {
		// get current settings
		data, err = getUserPushInfo(c, contextUser(c))
		if err != nil {
			return err
		}

		// patch settings according to the payload
		if v, ok := body["notify"].(bool); ok {
			data.Enabled = v
		}
		if v, ok := body["iostart"].(bool); ok {
			data.IOStart = v
		}
		if v, ok := body["ioext"]; ok {
			if v == nil {
				data.Ext.Enabled = false
				data.Pext = nil
			} else if v, ok := v.(map[string]interface{}); ok {
				data.Ext.Enabled = true
				data.Ext.Name, _ = v["name"].(string)
				data.Ext.Lat, _ = v["lat"].(float64)
				data.Ext.Lng, _ = v["lng"].(float64)
				data.Pext = &data.Ext
			}
		}
		regid, _ := body["subscriber"].(string)
		endpoint, _ := body["endpoint"].(string)
		endpoint = pushEndpointURL(regid, endpoint)
		if endpoint == config.Google.GCM.Endpoint {
			return &apiError{msg: "invalid endpoint", code: http.StatusBadRequest}
		}
		var exists bool
		for _, e := range data.Endpoints {
			if e == endpoint {
				exists = true
				break
			}
		}
		if !exists && endpoint != "" {
			data.Endpoints = append(data.Endpoints, endpoint)
		}

		// store user configuration
		return storeUserPushInfo(c, data)
	})

	if terr != nil {
		writeJSONError(c, w, errStatus(terr), err)
		return
	}
	json.NewEncoder(w).Encode(data)
}

// syncEventData updates event data stored in a persistent DB,
// diffs the changes with a previous version, stores those changes
// and spawns up workers to send push notifications to interested parties.
func syncEventData(w http.ResponseWriter, r *http.Request) {
	c := newContext(r)
	// allow only cron jobs, task queues and GCS but don't tell them that
	tque := r.Header.Get("x-appengine-cron") == "true" || r.Header.Get("x-appengine-taskname") != ""
	if t := r.Header.Get("x-goog-channel-token"); t != config.SyncToken && !tque {
		logf(c, "NOT performing sync: x-goog-channel-token = %q", t)
		return
	}

	i, err := cache.inc(c, syncGCSCacheKey, 1, 0)
	if err != nil {
		writeError(w, err)
		return
	}
	if i > 1 {
		logf(c, "GCS sync: already running")
		return
	}

	err = runInTransaction(c, func(c context.Context) error {
		oldData, err := getLatestEventData(c, nil)
		if err != nil {
			return err
		}

		newData, err := fetchEventData(c, config.Schedule.ManifestURL, oldData.modified)
		if err != nil {
			return err
		}
		if isEmptyEventData(newData) {
			logf(c, "%s: no data or not modified (last: %s)", config.Schedule.ManifestURL, oldData.modified)
			return nil
		}
		if err := storeEventData(c, newData); err != nil {
			return err
		}

		diff := diffEventData(oldData, newData)
		if isEmptyChanges(diff) {
			logf(c, "%s: diff is empty (last: %s)", config.Schedule.ManifestURL, oldData.modified)
			return nil
		}
		if err := storeChanges(c, diff); err != nil {
			return err
		}
		if err := notifySubscribersAsync(c, diff, false); err != nil {
			return err
		}
		return nil
	})

	if _, cerr := cache.inc(c, syncGCSCacheKey, -1000, 0); cerr != nil {
		errorf(c, cerr.Error())
	}

	if err != nil {
		errorf(c, "syncEventSchedule: %v", err)
		writeError(w, err)
	}
}

// serverUserUpdates responds with a dataChanges containing a diff
// between provided timestamp and current time.
// Timestamp is encoded in the Authorization token which the client
// must know beforehand.
func serveUserUpdates(w http.ResponseWriter, r *http.Request) {
	ah := r.Header.Get("authorization")
	// first request to get SW token
	if strings.HasPrefix(strings.ToLower(ah), bearerHeader) {
		serveSWToken(w, r)
		return
	}

	// handle a request with SW token
	c := newContext(r)
	w.Header().Set("Content-Type", "application/json;charset=utf-8")
	user, ts, err := decodeSWToken(ah)
	if err != nil {
		writeJSONError(c, w, http.StatusForbidden, err)
		return
	}
	c = context.WithValue(c, ctxKeyUser, user)

	// fetch user data in parallel with dataChanges
	var (
		bookmarks []string
		pushInfo  *userPush
		userErr   error
	)
	done := make(chan struct{})
	go func() {
		defer close(done)
		if bookmarks, userErr = userSchedule(c, user); userErr != nil {
			return
		}
		pushInfo, userErr = getUserPushInfo(c, user)
	}()

	dc, err := getChangesSince(c, ts)
	if err != nil {
		writeJSONError(c, w, errStatus(err), err)
		return
	}

	select {
	case <-time.After(10 * time.Second):
		errorf(c, "userSchedule/getUserPushInfo timed out")
		writeJSONError(c, w, http.StatusInternalServerError, "timeout")
		return
	case <-done:
		// user data goroutine finished
	}

	// userErr indicates any error in the user data retrieval
	if userErr != nil {
		errorf(c, "userErr: %v", userErr)
		writeJSONError(c, w, http.StatusInternalServerError, userErr)
		return
	}

	filterUserChanges(dc, bookmarks, pushInfo.Pext)
	dc.Token, err = encodeSWToken(user, dc.Updated.Add(1*time.Second))
	if err != nil {
		writeJSONError(c, w, http.StatusInternalServerError, err)
	}
	logsess := make([]string, 0, len(dc.Sessions))
	for k := range dc.Sessions {
		logsess = append(logsess, k)
	}
	logf(c, "sending %d updated sessions to user %s: %s", len(logsess), user, strings.Join(logsess, ", "))
	if err := json.NewEncoder(w).Encode(dc); err != nil {
		errorf(c, "serveUserUpdates: encode resp: %v", err)
	}
}

// serveSWToken responds with an SW authorization token used by the client
// in subsequent serveUserUpdates requests.
func serveSWToken(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json;charset=utf-8")
	c, err := authUser(newContext(r), r.Header.Get("authorization"))
	if err != nil {
		writeJSONError(c, w, errStatus(err), err)
		return
	}

	now := time.Now()
	token, err := encodeSWToken(contextUser(c), now)
	if err != nil {
		writeJSONError(c, w, errStatus(err), err)
		return
	}
	dc := &dataChanges{Token: token, Updated: now}
	if err := json.NewEncoder(w).Encode(dc); err != nil {
		errorf(c, "serveSWToke: encode resp: %v", err)
	}
}

// handleUserSurvey is the entry point for /api/v1/user/survey
func handleUserSurvey(w http.ResponseWriter, r *http.Request) {
	if r.Method == "GET" {
		serveUserSurvey(w, r)
		return
	}
	submitUserSurvey(w, r)
}

// serveUserSurvey responds with the session IDs
// a user has already submitted feedback for.
func serveUserSurvey(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json;charset=utf-8")
	c, err := authUser(newContext(r), r.Header.Get("authorization"))
	if err != nil {
		writeJSONError(c, w, errStatus(err), err)
		return
	}
	if isDev() {
		w.Write([]byte(`["__keynote__"]`))
		return
	}
	sessions, err := submittedSurveySessions(c, contextUser(c))
	if err != nil {
		writeJSONError(c, w, http.StatusInternalServerError, err)
		return
	}
	if sessions == nil {
		sessions = []string{}
	}
	if err := json.NewEncoder(w).Encode(sessions); err != nil {
		errorf(c, "encode(%v): %v", sessions, err)
	}
}

// submitUserSurvey submits survey responses for a specific session or a batch.
func submitUserSurvey(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json;charset=utf-8")
	c, err := authUser(newContext(r), r.Header.Get("authorization"))
	if err != nil {
		writeJSONError(c, w, errStatus(err), err)
		return
	}

	survey := &sessionSurvey{}
	if err := json.NewDecoder(r.Body).Decode(survey); err != nil {
		writeJSONError(c, w, http.StatusBadRequest, err)
		return
	}
	if !survey.valid() {
		writeJSONError(c, w, http.StatusBadRequest, "invalid data")
		return
	}

	sid := path.Base(r.URL.Path)
	if isDev() {
		w.Write([]byte(`["` + sid + `"]`))
		return
	}

	// we don't accept feedback for certain sessions
	if disabledSurvey(sid) {
		writeJSONError(c, w, http.StatusBadRequest, "survey feedback not allowed for this session")
		return
	}
	// accept only for existing sessions
	s, err := getSessionByID(c, sid)
	if err != nil {
		writeJSONError(c, w, http.StatusNotFound, err)
		return
	}
	// don't allow early submissions on prod
	if isProd() && time.Now().Before(s.StartTime) {
		writeJSONError(c, w, http.StatusBadRequest, "too early")
		return
	}

	data, err := addSessionSurvey(c, contextUser(c), sid)
	if err != nil {
		writeJSONError(c, w, errStatus(err), err)
		return
	}
	err = submitSessionSurvey(c, sid, survey)
	if err != nil {
		errorf(c, err.Error())
		// try async if it didn't work right away; at most 3 retries
		for i := 0; i < 4 && err != nil; i += 1 {
			time.Sleep(time.Duration(i) * time.Second)
			err = submitSessionSurveyAsync(c, sid, survey)
		}
	}
	if err != nil {
		// we could still recover feedback data from the logs in the worst case
		errorf(c, "could not submit feedback for %s: %s", sid, survey)
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(data)
}

// TODO: add ioext params
func handleNotifySubscribers(w http.ResponseWriter, r *http.Request) {
	c := newContext(r)
	retry, err := taskRetryCount(r)
	if err != nil || retry > maxTaskRetry {
		errorf(c, "retry = %d, err: %v", retry, err)
		return
	}

	all := r.FormValue("all") == "true"
	sessions := strings.Split(r.FormValue("sessions"), " ")
	if len(sessions) == 0 && !all {
		logf(c, "handleNotifySubscribers: empty sessions list; won't notify")
		return
	}

	users, err := listUsersWithPush(c)
	if err != nil {
		errorf(c, "handleNotifySubscribers: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	logf(c, "found %d users with notifications enabled", len(users))
	for _, id := range users {
		if err := pingUserAsync(c, id, sessions, all); err != nil {
			errorf(c, "handleNotifySubscribers: %v", err)
			// TODO: handle this error case
		}
	}
}

// handlePingUser schedules a GCM "ping" to user devices based on certain conditions.
func handlePingUser(w http.ResponseWriter, r *http.Request) {
	c := newContext(r)
	retry, err := taskRetryCount(r)
	if err != nil || retry > maxTaskRetry {
		errorf(c, "retry = %d, err: %v", retry, err)
		return
	}

	user := r.FormValue("uid")
	all := r.FormValue("all") == "true"
	// TODO: add ioext conditions
	sessions := strings.Split(r.FormValue("sessions"), " ")
	sort.Strings(sessions)
	if user == "" || (len(sessions) == 0 && !all) {
		errorf(c, "invalid params user = %q; session = %v; all = %v", user, sessions, all)
		return
	}

	var pi *userPush
	// transactional because we want to upgrade registration IDs to endpoints early
	terr := runInTransaction(c, func(c context.Context) error {
		pi, err = getUserPushInfo(c, user)
		if err != nil {
			return err
		}
		if len(pi.Subscribers) > 0 {
			pi.Endpoints = upgradeSubscribers(pi.Subscribers, pi.Endpoints)
			pi.Subscribers = nil
			return storeUserPushInfo(c, pi)
		}
		return nil
	})
	if terr != nil {
		errorf(c, err.Error())
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	if !pi.Enabled {
		logf(c, "notifications not enabled")
		return
	}

	matched := all
	if !all {
		bookmarks, err := userSchedule(c, user)
		if ue, ok := err.(*url.Error); ok && (ue.Err == errAuthInvalid || ue.Err == errAuthMissing) {
			errorf(c, "unrecoverable: %v", err)
			return
		}
		if err != nil {
			errorf(c, "%v", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		for _, id := range bookmarks {
			i := sort.SearchStrings(sessions, id)
			if matched = i < len(sessions) && sessions[i] == id; matched {
				break
			}
		}
	}

	if !matched {
		logf(c, "none of user sessions matched")
		return
	}

	// retry scheduling of /task/ping-device n times in case of errors,
	// pausing i seconds on each iteration where i ranges from 0 to n.
	// currently this will total to about 15sec latency in the worst successful case.
	nr := 5
	endpoints := pi.Endpoints
	for i := 0; i < nr+1; i++ {
		endpoints, err = pingDevicesAsync(c, user, endpoints, 0)
		if err == nil {
			break
		}
		errorf(c, "couldn't schedule ping for %d of %d devices; retry = %d/%d",
			len(endpoints), len(pi.Endpoints), i, nr)
		time.Sleep(time.Duration(i) * time.Second)
	}
}

// handlePingDevices handles a request to notify a single user device.
func handlePingDevice(w http.ResponseWriter, r *http.Request) {
	c := newContext(r)
	retry, err := taskRetryCount(r)
	if err != nil || retry > maxTaskRetry {
		errorf(c, "retry = %d, err: %v", retry, err)
		return
	}

	uid := r.FormValue("uid")
	endpoint := r.FormValue("endpoint")
	if uid == "" || endpoint == "" {
		errorf(c, "invalid params: uid = %q; endpoint = %q", uid, endpoint)
		return
	}

	nurl, err := pingDevice(c, endpoint)
	if err == nil {
		if nurl != "" {
			terr := runInTransaction(c, func(c context.Context) error {
				return updatePushEndpoint(c, uid, endpoint, nurl)
			})
			// no worries if this errors out, we'll do it next time
			if terr != nil {
				errorf(c, terr.Error())
			}
		}
		return
	}

	errorf(c, "%v", err)
	pe, ok := err.(*pushError)
	if !ok {
		// unrecoverable error
		return
	}

	if pe.remove {
		terr := runInTransaction(c, func(c context.Context) error {
			return deletePushEndpoint(c, uid, endpoint)
		})
		if terr != nil {
			errorf(c, terr.Error())
		}
		// pe.remove also means no retry is necessary
		return
	}

	if !pe.retry {
		return
	}
	// schedule a new task according to Retry-After
	_, err = pingDevicesAsync(c, uid, []string{endpoint}, pe.after)
	if err != nil {
		// re-scheduling didn't work: retry the whole thing
		errorf(c, err.Error())
		w.WriteHeader(http.StatusInternalServerError)
	}
}

// handlePingExt sends a "ping" POST request to config.ExtPingURL.
func handlePingExt(w http.ResponseWriter, r *http.Request) {
	c := newContext(r)
	retry, err := taskRetryCount(r)
	if err != nil || retry > maxTaskRetry {
		errorf(c, "retry = %d, err: %v", retry, err)
		return
	}

	key := r.FormValue("key")
	if key == "" {
		errorf(c, "handlePingExt: key value is zero")
		return
	}
	p := strings.NewReader(`{"sync_jitter": 0}`)
	req, err := http.NewRequest("POST", config.ExtPingURL, p)
	if err != nil {
		errorf(c, "handlePingExt: %v", err)
		return
	}

	req.Header.Set("content-type", "application/json")
	req.Header.Set("authorization", "key="+key)
	res, err := httpClient(c).Do(req)

	if err != nil {
		errorf(c, "handlePingExt: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	defer res.Body.Close()
	if res.StatusCode == http.StatusOK {
		return
	}
	b, _ := ioutil.ReadAll(res.Body)
	errorf(c, "handlePingExt: remote says %q\nResponse: %s", res.Status, b)
	if res.StatusCode > 499 {
		w.WriteHeader(http.StatusInternalServerError)
	}
}

// handleClock compares time.Now() to each session and notifies users about starting sessions.
// It must be run frequently, every minute or so.
func handleClock(w http.ResponseWriter, r *http.Request) {
	c := newContext(r)
	retry, err := taskRetryCount(r)
	if h := r.Header.Get("x-appengine-cron"); h != "true" && err == nil && retry > 0 {
		errorf(c, "cron = %s, retry = %d, err: %v", h, retry, err)
		return
	}

	data, err := getLatestEventData(c, nil)
	if err != nil {
		errorf(c, "%v", err)
		return
	}
	sessions := make([]*eventSession, 0, len(data.Sessions))
	for _, s := range data.Sessions {
		sessions = append(sessions, s)
	}
	now := time.Now()
	upsess := upcomingSessions(now, sessions)
	upsurvey := upcomingSurveys(now, sessions)
	allsess := append(upsess, upsurvey...)

	terr := runInTransaction(c, func(c context.Context) error {
		allsess, err = filterNextSessions(c, allsess)
		if err != nil {
			return err
		}
		if len(allsess) == 0 {
			return nil
		}
		logf(c, "found %d upcoming sessions and %d surveys", len(upsess), len(upsurvey))
		dc := &dataChanges{
			Updated:   now,
			eventData: eventData{Sessions: make(map[string]*eventSession, len(allsess))},
		}
		for _, s := range allsess {
			dc.Sessions[s.Id] = s
		}
		if err := storeNextSessions(c, allsess); err != nil {
			return err
		}
		if err := storeChanges(c, dc); err != nil {
			return err
		}
		return notifySubscribersAsync(c, dc, len(upsurvey) > 0)
	})
	if terr != nil {
		errorf(c, "txn err: %v", terr)
	}
}

// handleEasterEgg is the easter egg link handler.
// It replaces current link with the new one.
func handleEasterEgg(w http.ResponseWriter, r *http.Request) {
	if r.Method == "GET" {
		serveEasterEgg(w, r)
		return
	}

	c := newContext(r)
	if v := r.Header.Get("authorization"); v != config.SyncToken {
		writeJSONError(c, w, http.StatusForbidden, errAuthInvalid)
		return
	}
	egg := &easterEgg{}
	if err := json.NewDecoder(r.Body).Decode(egg); err != nil {
		writeJSONError(c, w, errStatus(err), err)
		return
	}
	if err := storeEasterEgg(c, egg); err != nil {
		writeJSONError(c, w, errStatus(err), err)
	}
}

// serveEasterEgg responds with current egg link
func serveEasterEgg(w http.ResponseWriter, r *http.Request) {
	c := newContext(r)
	link := getEasterEggLink(c)
	if link == "" && isDev() {
		link = "http://example.org/test"
	}
	w.Header().Set("content-type", "application/json")
	fmt.Fprintf(w, `{"link": %q}`, link)
}

// servePhotosProxy serves as a server proxy for Picasa's JSON feeds.
func servePhotosProxy(w http.ResponseWriter, r *http.Request) {
	c := newContext(r)
	if r.Method != "GET" {
		writeJSONError(c, w, http.StatusBadRequest, "invalid request method")
		return
	}
	url := r.FormValue("url")
	if !strings.HasPrefix(url, "https://picasaweb.google.com/data/feed/api") {
		writeJSONError(c, w, http.StatusBadRequest, "url parameter is missing or is an invalid endpoint")
		return
	}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		writeJSONError(c, w, errStatus(err), err)
		return
	}

	res, err := httpClient(c).Do(req)
	if err != nil {
		writeJSONError(c, w, errStatus(err), err)
		return
	}

	defer res.Body.Close()
	w.Header().Set("Content-Type", "application/json;charset=utf-8")
	w.WriteHeader(res.StatusCode)
	io.Copy(w, res.Body)
}

// handleAdmin renders admin home page on 'GET' requests,
// and modifies config otherwise.
// It is accessible only to config.Admins.
func handleAdmin(w http.ResponseWriter, r *http.Request) {
	c := newContext(r)

	if r.Method == "GET" {
		w.Header().Set("Content-Type", "text/html;charset=utf-8")
		tfile := "home"
		if r.URL.Path[len(r.URL.Path)-1] != '/' {
			tfile = path.Base(r.URL.Path)
		}
		t, err := template.ParseFiles(filepath.Join(config.Dir, templatesDir, "admin", tfile+".html"))
		if err != nil {
			writeError(w, err)
			return
		}
		if err := t.Execute(w, nil); err != nil {
			errorf(c, "handleAdmin: %v", err)
		}
		return
	}
}

// debugGetURL fetches a URL with service account credentials.
// Should not be available on prod.
func debugServiceGetURL(w http.ResponseWriter, r *http.Request) {
	c := newContext(r)
	req, err := http.NewRequest("GET", r.FormValue("url"), nil)
	if err != nil {
		writeJSONError(c, w, errStatus(err), err)
		return
	}
	if req.URL.Scheme != "https" {
		writeJSONError(c, w, http.StatusBadRequest, "dude, use https!")
		return
	}

	hc, err := serviceAccountClient(c, "https://www.googleapis.com/auth/devstorage.read_only")
	if err != nil {
		writeJSONError(c, w, errStatus(err), err)
		return
	}

	res, err := hc.Do(req)
	if err != nil {
		writeJSONError(c, w, errStatus(err), err)
		return
	}
	defer res.Body.Close()
	w.Header().Set("Content-Type", res.Header.Get("Content-Type"))
	w.WriteHeader(res.StatusCode)
	io.Copy(w, res.Body)
}

// debugPush stores dataChanges from r in the DB and calls notifySubscribersAsync.
// dataChanges.Token is ignored; dataChanges.Changed is set to current time if not provided.
// Should not be available on prod.
func debugPush(w http.ResponseWriter, r *http.Request) {
	c := newContext(r)

	if r.Method == "GET" {
		w.Header().Set("Content-Type", "text/html;charset=utf-8")
		t, err := template.ParseFiles(filepath.Join(config.Dir, templatesDir, "debug", "push.html"))
		if err != nil {
			writeError(w, err)
			return
		}
		if err := t.Execute(w, nil); err != nil {
			errorf(c, "debugPush: %v", err)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	dc := &dataChanges{}
	if err := json.NewDecoder(r.Body).Decode(dc); err != nil {
		writeJSONError(c, w, http.StatusBadRequest, err)
		return
	}
	if dc.Updated.IsZero() {
		dc.Updated = time.Now()
	}

	all := false
	for _, s := range dc.Sessions {
		if s.Update == updateSurvey {
			all = true
			break
		}
	}

	fn := func(c context.Context) error {
		if err := storeChanges(c, dc); err != nil {
			return err
		}
		return notifySubscribersAsync(c, dc, all)
	}

	if err := runInTransaction(c, fn); err != nil {
		writeJSONError(c, w, http.StatusInternalServerError, err)
	}
}

// debugSync updates locally stored EventData with staging or prod data.
// Should not be available on prod.
func debugSync(w http.ResponseWriter, r *http.Request) {
	c := newContext(r)

	if r.Method == "GET" {
		w.Header().Set("Content-Type", "text/html;charset=utf-8")
		t, err := template.ParseFiles(filepath.Join(config.Dir, templatesDir, "debug", "sync.html"))
		if err != nil {
			writeError(w, err)
			return
		}
		data := struct {
			Env       string
			Prefix    string
			Manifest  string
			SyncToken string
		}{
			config.Env,
			config.Prefix,
			config.Schedule.ManifestURL,
			config.SyncToken,
		}
		if err := t.Execute(w, &data); err != nil {
			errorf(c, err.Error())
		}
		return
	}

	if err := clearEventData(c); err != nil {
		writeError(w, err)
	}
}

// writeJSONError sets response code to 500 and writes an error message to w.
// If err is *apiError, code is overwritten by err.code.
// TODO: remove code from the args and use only apiError.
func writeJSONError(c context.Context, w http.ResponseWriter, code int, err interface{}) {
	errorf(c, "%v", err)
	if aerr, ok := err.(*apiError); ok {
		code = aerr.code
	}
	w.WriteHeader(code)
	fmt.Fprintf(w, `{"error": %q}`, err)
}

// writeError writes error to w as is, using errStatus() status code.
func writeError(w http.ResponseWriter, err error) {
	w.WriteHeader(errStatus(err))
	w.Write([]byte(err.Error()))
}

// errStatus converts some known errors of this package into the corresponding
// HTTP response status code.
// Defaults to 500 Internal Server Error.
func errStatus(err error) int {
	if aerr, ok := err.(*apiError); ok {
		return aerr.code
	}
	switch err {
	case errAuthMissing:
		return http.StatusUnauthorized
	case errAuthInvalid:
		return http.StatusForbidden
	case errAuthTokenType:
		return 498
	case errBadData:
		return http.StatusBadRequest
	case errNotFound:
		return http.StatusNotFound
	default:
		return http.StatusInternalServerError
	}
}

// taskRetryCount returns the number times the task has been retried.
func taskRetryCount(r *http.Request) (int, error) {
	n, err := strconv.Atoi(r.Header.Get("X-AppEngine-TaskExecutionCount"))
	if err != nil {
		return -1, fmt.Errorf("taskRetryCount: %v", err)
	}
	return n - 1, nil
}

// toAPISchedule converts eventData to /api/v1/schedule response format.
// Original d elements may be modified.
func toAPISchedule(d *eventData) interface{} {
	sessions := make([]*eventSession, 0, len(d.Sessions))
	for _, s := range d.Sessions {
		sessions = append(sessions, s)
	}
	sort.Sort(sortedSessionsList(sessions))
	for _, s := range d.Speakers {
		s.Thumb = thumbURL(s.Thumb)
	}
	videos := make([]*eventVideo, 0, len(d.Videos))
	for _, v := range d.Videos {
		videos = append(videos, v)
	}
	sort.Sort(sortedVideosList(videos))
	return &struct {
		Sessions []*eventSession          `json:"sessions,omitempty"`
		Videos   []*eventVideo            `json:"video_library,omitempty"`
		Speakers map[string]*eventSpeaker `json:"speakers,omitempty"`
		Tags     map[string]*eventTag     `json:"tags,omitempty"`
	}{
		Sessions: sessions,
		Videos:   videos,
		Speakers: d.Speakers,
		Tags:     d.Tags,
	}
}

// canonicalURL returns a canonical URL of the page rendered for a request at URL u.
func canonicalURL(r *http.Request, q url.Values) string {
	// make sure path has site prefix
	p := r.URL.Path
	if !strings.HasPrefix(p, config.Prefix) {
		p = path.Join(config.Prefix, p)
	}
	// remove /home
	if p == path.Join(config.Prefix, "home") {
		p = config.Prefix + "/"
	}
	// re-add trailing slash if needed
	if p == config.Prefix {
		p += "/"
	}

	u := &url.URL{
		Scheme: "https",
		Host:   r.Host,
		Path:   p,
	}
	if r.TLS == nil {
		u.Scheme = "http"
	}
	if q != nil {
		u.RawQuery = q.Encode()
	}
	return u.String()
}

// ctxKey is a custom type for context.Context values.
// See below for specific keys.
type ctxKey int

const ctxKeyUser ctxKey = iota

func contextUser(c context.Context) string {
	user, _ := c.Value(ctxKeyUser).(string)
	return user
}
