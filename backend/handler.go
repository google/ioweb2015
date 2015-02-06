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

// wrapHandler is the last in a handler chain call,
// which wraps all app handlers.
// A variable so that GAE and standalone can have different wrappers.
var wrapHandler func(http.Handler) http.Handler

// handle registers a handle function fn for the pattern prefixed
// with httpPrefix.
func handle(pattern string, fn func(w http.ResponseWriter, r *http.Request)) {
	p := path.Join(httpPrefix, pattern)
	if pattern[len(pattern)-1] == '/' {
		p += "/"
	}
	http.Handle(p, handler(fn))
}

// handler creates a new func from fn with stripped prefix
// and wrapped with wrapHandler.
func handler(fn func(w http.ResponseWriter, r *http.Request)) http.Handler {
	var h http.Handler = http.HandlerFunc(fn)
	if httpPrefix != "/" {
		h = http.StripPrefix(httpPrefix, h)
	}
	if wrapHandler != nil {
		h = wrapHandler(h)
	}
	return h
}

// serveTemplate responds with text/html content of the executed template
// found under request base path.
// 'home' template is assumed if request path ends with '/'.
func serveTemplate(w http.ResponseWriter, r *http.Request) {
	c := newContext(r, w)

	r.ParseForm()
	_, wantsPartial := r.Form["partial"]
	_, experimentShare := r.Form["experiment"]

	tplname := path.Base(r.URL.Path)
	switch {
	case tplname == "." || tplname == "/":
		tplname = "home"
	case strings.HasSuffix(tplname, ".html"):
		tplname = tplname[:len(tplname)-5]
	}

	data := &templateData{Env: env(c), OgImage: ogImageDefault}
	if experimentShare {
		data.OgImage = ogImageExperiment
	}
	w.Header().Set("Content-Type", "text/html;charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=300")
	err := renderTemplate(c, tplname, wantsPartial, data)

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

	c := newContext(r, w)
	w.Header().Set("Cache-Control", "public, max-age=60")
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

// serveSocial responds with 10 most recent tweets.
// See socEntry struct for fields format.
func serveSocial(w http.ResponseWriter, r *http.Request) {
	r.ParseForm()
	_, refresh := r.Form["refresh"]

	c := newContext(r, w)
	w.Header().Set("Cache-Control", "public, max-age=60")
	w.Header().Set("Content-Type", "application/json;charset=utf-8")

	// respond with stubbed JSON entries in dev mode
	if env(c) == "dev" {
		f := filepath.Join(rootDir, "temporary_api", "social_feed.json")
		http.ServeFile(w, r, f)
		return
	}

	entries, err := socialEntries(c, refresh)
	if err != nil {
		log.Printf("socialEntries: %v", err)
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
