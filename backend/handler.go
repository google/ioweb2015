package main

import (
	"encoding/json"
	"errors"
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

// syncGCSCacheKey guards GCS sync task against choking
// when requests coming too fast.
const syncGCSCacheKey = "sync:gcs"

// wrapHandler is the last in a handler chain call,
// which wraps all app handlers.
// GAE and standalone servers have different wrappers, hence a variable.
var wrapHandler func(http.Handler) http.Handler

// rootHandleFn is a request handler func for config.Prefix pattern.
// GAE and standalone servers have different root handle func.
var rootHandleFn func(http.ResponseWriter, *http.Request)

// registerHandlers sets up all backend handle funcs, including the API.
func registerHandlers() {
	handle("/", rootHandleFn)
	handle("/api/v1/extended", serveIOExtEntries)
	handle("/api/v1/social", serveSocial)
	handle("/api/v1/auth", handleAuth)
	handle("/api/v1/schedule", serveSchedule)
	handle("/api/v1/user/schedule", handleUserSchedule)
	handle("/api/v1/user/schedule/", handleUserSchedule)
	handle("/api/v1/user/notify", handleUserNotifySettings)
	handle("/api/v1/user/updates", serveUserUpdates)
	handle("/sync/gcs", syncEventData)
	handle("/task/notify-subscribers", handleNotifySubscribers)
	handle("/task/ping-user", handlePingUser)
	handle("/task/ping-device", handlePingDevice)
	handle("/task/ping-ext", handlePingExt)
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
		logf(c, "warmup: env = %s", config.Env)
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

	data := &templateData{}
	if experimentShare {
		data.OgTitle = defaultTitle
		data.OgImage = ogImageExperiment
		data.Desc = descExperiment
	}

	w.Header().Set("Content-Type", "text/html;charset=utf-8")
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
		writeJSONError(c, w, http.StatusBadRequest, fmt.Errorf("invalid JSON body: %v", err))
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
			writeJSONError(c, w, http.StatusBadRequest, errors.New("invalid session ID"))
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
		writeJSONError(c, w, http.StatusBadRequest, errors.New("invalid request method"))
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
		if sub, ok := body["subscriber"].(string); ok {
			url, ok := body["endpoint"].(string)
			if !ok || url == "" {
				url = config.Google.GCM.Endpoint
			}
			var exists bool
			for _, s := range data.Subscribers {
				if s == sub {
					exists = true
					break
				}
			}
			if !exists {
				data.Subscribers = append(data.Subscribers, sub)
				data.Endpoints = append(data.Endpoints, url)
			}
		}
		if v, exists := body["ioext"]; exists {
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
		if err := notifySubscribersAsync(c, diff); err != nil {
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
		writeJSONError(c, w, http.StatusInternalServerError, errors.New("timeout"))
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

// TODO: add ioext params
func handleNotifySubscribers(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("x-appengine-taskname") == "" {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	c := newContext(r)
	sessions := strings.Split(r.FormValue("sessions"), " ")
	if len(sessions) == 0 {
		logf(c, "handleNotifySubscribers: empty sessions list; won't notify")
		return
	}

	users, err := listUsersWithPush(c)
	if err != nil {
		errorf(c, "handleNotifySubscribers: %v")
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	logf(c, "found %d users with notifications enabled", len(users))
	for _, id := range users {
		if err := pingUserAsync(c, id, sessions); err != nil {
			errorf(c, "handleNotifySubscribers: %v", err)
			// TODO: handle this error case
		}
	}
}

// handlePingUser schedules a GCM "ping" to user devices based on certain conditions.
func handlePingUser(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("x-appengine-taskname") == "" {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	c := newContext(r)
	user := r.FormValue("uid")
	pi, err := getUserPushInfo(c, user)
	if err != nil {
		errorf(c, err.Error())
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	if !pi.Enabled {
		logf(c, "notifications not enabled")
		return
	}

	// TODO: add ioext conditions
	sessions := strings.Split(r.FormValue("sessions"), " ")
	sort.Strings(sessions)
	if user == "" || len(sessions) == 0 {
		errorf(c, "invalid params user = %q; session = %v", user, sessions)
		return
	}

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
	var matched bool
	for _, id := range bookmarks {
		i := sort.SearchStrings(sessions, id)
		if matched = i < len(sessions) && sessions[i] == id; matched {
			break
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
	regs, endpoints := pi.Subscribers, pi.Endpoints
	for i := 0; i < nr+1; i++ {
		regs, endpoints, err = pingDevicesAsync(c, user, regs, endpoints, 0)
		if err == nil {
			break
		}
		errorf(c, "couldn't schedule ping for %d of %d devices; retry = %d/%d",
			len(regs), len(pi.Subscribers), i, nr)
		time.Sleep(time.Duration(i) * time.Second)
	}
}

// handlePingDevices handles a request to notify a single user device.
func handlePingDevice(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("x-appengine-taskname") == "" {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	c := newContext(r)
	uid := r.FormValue("uid")
	rid := r.FormValue("rid")
	endpoint := r.FormValue("endpoint")
	if uid == "" || rid == "" || endpoint == "" {
		errorf(c, "invalid params: uid = %q; rid = %q; endpoint = %q", uid, rid, endpoint)
		return
	}

	nreg, err := pingDevice(c, rid, endpoint)
	if err == nil {
		if nreg != "" {
			terr := runInTransaction(c, func(c context.Context) error {
				return updateSubscriber(c, uid, rid, nreg)
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
			return deleteSubscriber(c, uid, rid)
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
	_, _, err = pingDevicesAsync(c, uid, []string{rid}, []string{endpoint}, pe.after)
	if err != nil {
		// scheduling didn't work: retry the whole thing
		errorf(c, err.Error())
		w.WriteHeader(http.StatusInternalServerError)
	}
}

// handlePingExt sends a "ping" POST request to config.ExtPingURL.
// On GAE, it will retry at least 3 times before giving up.
func handlePingExt(w http.ResponseWriter, r *http.Request) {
	c := newContext(r)
	retry, err := strconv.Atoi(r.Header.Get("X-AppEngine-TaskExecutionCount"))
	if err != nil {
		errorf(c, "handlePingExt: invalid X-AppEngine-TaskExecutionCount: %v", err)
		return
	}
	if retry > 2 {
		errorf(c, "handlePingExt: retry = %d; giving up.", retry)
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
	if res.StatusCode != http.StatusOK {
		b, _ := ioutil.ReadAll(res.Body)
		errorf(c, "handlePingExt: remote says %q\nResponse: %s", res.Status, b)
		w.WriteHeader(http.StatusInternalServerError)
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
		writeJSONError(c, w, http.StatusBadRequest, errors.New("dude, use https!"))
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

	fn := func(c context.Context) error {
		if err := storeChanges(c, dc); err != nil {
			return err
		}
		return notifySubscribersAsync(c, dc)
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
func writeJSONError(c context.Context, w http.ResponseWriter, code int, err error) {
	errorf(c, err.Error())
	w.WriteHeader(code)
	fmt.Fprintf(w, `{"error": %q}`, err.Error())
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
	switch err {
	case errAuthMissing:
		return http.StatusUnauthorized
	case errAuthInvalid:
		return http.StatusForbidden
	case errAuthTokenType:
		return 498
	default:
		return http.StatusInternalServerError
	}
}

// toAPISchedule converts eventData to /api/v1/schedule response format.
func toAPISchedule(d *eventData) interface{} {
	sessions := make([]*eventSession, 0, len(d.Sessions))
	for _, s := range d.Sessions {
		sessions = append(sessions, s)
	}
	sort.Sort(sortedSessionsList(sessions))
	return &struct {
		Sessions []*eventSession          `json:"sessions,omitempty"`
		Speakers map[string]*eventSpeaker `json:"speakers,omitempty"`
		Videos   map[string]*eventVideo   `json:"video_library,omitempty"`
		Tags     map[string]*eventTag     `json:"tags,omitempty"`
	}{
		Sessions: sessions,
		Speakers: d.Speakers,
		Videos:   d.Videos,
		Tags:     d.Tags,
	}

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

// ctxKey is a custom type for context.Context values.
// See below for specific keys.
type ctxKey int

const ctxKeyUser ctxKey = iota

func contextUser(c context.Context) string {
	user, _ := c.Value(ctxKeyUser).(string)
	return user
}
