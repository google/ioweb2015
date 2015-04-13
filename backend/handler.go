package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"golang.org/x/net/context"
)

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
	handle("/api/v1/user/schedule", serveUserSchedule)
	handle("/api/v1/user/schedule/", handleUserBookmarks)
	// setup root redirect if we're prefixed
	if config.Prefix != "/" {
		var redirect http.Handler = http.HandlerFunc(redirectHandler)
		if wrapHandler != nil {
			redirect = wrapHandler(redirect)
		}
		http.Handle("/", redirect)
	}
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
		writeJSONError(w, http.StatusInternalServerError, err)
		return
	}

	body, err := json.Marshal(entries)
	if err != nil {
		errorf(c, "json.Marshal: %v", err)
		writeJSONError(w, http.StatusInternalServerError, err)
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
		writeJSONError(w, http.StatusInternalServerError, err)
		return
	}

	body, err := json.Marshal(entries)
	if err != nil {
		errorf(c, "json.Marshal: %v", err)
		writeJSONError(w, http.StatusInternalServerError, err)
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
		writeJSONError(w, errStatus(err), err)
		return
	}
	var flow struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&flow); err != nil {
		writeJSONError(w, http.StatusBadRequest, fmt.Errorf("invalid JSON body: %v", err))
		return
	}
	creds, err := fetchCredentials(c, flow.Code)
	if err != nil {
		writeJSONError(w, http.StatusForbidden, err)
		return
	}
	if err := storeCredentials(c, creds); err != nil {
		writeJSONError(w, http.StatusInternalServerError, err)
	}
}

func serveSchedule(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json;charset=utf-8")
	// respond with stubbed JSON entries in dev mode
	if isDev() {
		f := filepath.Join(config.Dir, "temporary_api", "schedule.json")
		http.ServeFile(w, r, f)
		return
	}

	// TODO: remove hardcoded URL and do a proper sync with the GCS bucket.
	c := newContext(r)
	url := "http://storage.googleapis.com/io2015-data.appspot.com/session_data_v1.1.json"
	data, err := fetchEventSchedule(c, url)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err)
		return
	}
	if err := json.NewEncoder(w).Encode(data); err != nil {
		errorf(c, "serveSchedule: %v", err)
	}
}

func serveUserSchedule(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json;charset=utf-8")
	c, err := authUser(newContext(r), r.Header.Get("authorization"))
	if err != nil {
		writeJSONError(w, errStatus(err), err)
		return
	}

	bookmarks, err := userSchedule(c)
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err)
		return
	}
	if err := json.NewEncoder(w).Encode(bookmarks); err != nil {
		errorf(c, "encode(%v): %v", bookmarks, err)
	}
}

func handleUserBookmarks(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json;charset=utf-8")
	c, err := authUser(newContext(r), r.Header.Get("authorization"))
	if err != nil {
		writeJSONError(w, errStatus(err), err)
		return
	}

	if r.URL.Path[len(r.URL.Path)-1] == '/' {
		writeJSONError(w, http.StatusBadRequest, errors.New("invalid session ID"))
		return
	}

	// TODO: check whether the session ID actually exists?
	sid := path.Base(r.URL.Path)

	switch r.Method {
	case "PUT":
		err = bookmarkSession(c, sid)
	case "DELETE":
		err = unbookmarkSession(c, sid)
	default:
		writeJSONError(w, http.StatusBadRequest, errors.New("invalid request method"))
		return
	}

	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, err)
	}
}

// writeJSONError sets response code to 500 and writes an error message to w.
func writeJSONError(w http.ResponseWriter, code int, err error) {
	w.WriteHeader(code)
	fmt.Fprintf(w, `{"error": %q}`, err.Error())
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
	default:
		return http.StatusInternalServerError
	}
}

// ctxKey is a custom type for context.Context values.
// See below for specific keys.
type ctxKey int

const ctxKeyUser ctxKey = iota

func contextUser(c context.Context) string {
	user, _ := c.Value(ctxKeyUser).(string)
	return user
}
