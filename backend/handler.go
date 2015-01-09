package main

import (
	"log"
	"net/http"
	"path"
	"strings"
)

// serveTemplate responds with text/html content of the executed template
// found under request base path.
// 'home' template is assumed if request path ends with '/'.
func serveTemplate(w http.ResponseWriter, r *http.Request) {
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
	err := renderTemplate(w, tplname, wantsPartial)

	if err != nil {
		log.Printf("renderTemplate: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}
