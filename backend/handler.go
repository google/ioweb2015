package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
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
	handle("/api/extended", serveIOExtEntries)
	handle("/api/social", serveSocial)
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
		writeJSONError(w, err)
		return
	}

	body, err := json.Marshal(entries)
	if err != nil {
		errorf(c, "json.Marshal: %v", err)
		writeJSONError(w, err)
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
		writeJSONError(w, err)
		return
	}

	body, err := json.Marshal(entries)
	if err != nil {
		errorf(c, "json.Marshal: %v", err)
		writeJSONError(w, err)
		return
	}

	if _, err := w.Write(body); err != nil {
		errorf(c, "w.Write: %v", err)
	}
}

// writeJSONError sets response code to 500 and writes an error message to w.
func writeJSONError(w http.ResponseWriter, err error) {
	w.WriteHeader(http.StatusInternalServerError)
	fmt.Fprintf(w, `{"error": %q}`, err.Error())
}
