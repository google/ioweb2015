package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"path"
	"path/filepath"
	"strings"
)

func registerHandlers() {
	handle("/", catchAllHandler)
	handle("/api/extended", serveIOExtEntries)
	// setup root redirect if we're prefixed
	if httpPrefix != "/" {
		http.Handle("/", http.RedirectHandler(httpPrefix, http.StatusFound))
	}
}

func handler(fn func(w http.ResponseWriter, r *http.Request)) http.Handler {
	var h http.Handler = http.HandlerFunc(fn)
	if httpPrefix != "/" {
		h = http.StripPrefix(httpPrefix, h)
	}
	return logHandler(h)
}

func handle(pattern string, fn func(w http.ResponseWriter, r *http.Request)) {
	http.Handle(path.Join(httpPrefix, pattern), handler(fn))
}

// serveTemplate responds with text/html content of the executed template
// found under request base path.
// 'home' template is assumed if request path ends with '/'.
func serveTemplate(w http.ResponseWriter, r *http.Request) {
	c := newContext(r)

	r.ParseForm()
	_, wantsPartial := r.Form["partial"]

	tplname := path.Base(r.URL.Path)
	switch {
	case tplname == "." || tplname == "/":
		tplname = "home"
	case strings.HasSuffix(tplname, ".html"):
		tplname = tplname[:len(tplname)-5]
	}

	w.Header().Set("Content-Type", "text/html;charset=utf-8")
	err := renderTemplate(w, env(c), tplname, wantsPartial)

	if err != nil {
		log.Printf("renderTemplate: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

// serveIOExtEntries responds with I/O extended entries in JSON format.
// See extEntry struct definition for more details.
func serveIOExtEntries(w http.ResponseWriter, r *http.Request) {
	r.ParseForm()
	_, refresh := r.Form["refresh"]

	c := newContext(r)
	w.Header().Set("Content-Type", "application/json;charset=utf-8")

	// respond with stubbed JSON entries in dev mode
	if env(c) == "dev" {
		f := filepath.Join(rootDir, "temporary_api", "ioext_feed.json")
		http.ServeFile(w, r, f)
		return
	}

	entries, err := ioExtEntries(c, refresh)
	if err != nil {
		log.Printf("ioExtEntries: %v", err)
		writeJSONError(w, err)
		return
	}

	body, err := json.Marshal(entries)
	if err != nil {
		log.Printf("json.Marshal: %v", err)
		writeJSONError(w, err)
		return
	}

	if _, err := w.Write(body); err != nil {
		log.Printf("w.Write: %v", err)
	}
}

// writeJSONError sets response code to 500 and writes an error message to w.
func writeJSONError(w http.ResponseWriter, err error) {
	w.WriteHeader(http.StatusInternalServerError)
	fmt.Fprintf(w, `{"error": %q}`, err.Error())
}
