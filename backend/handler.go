package main

import (
	"net/http"
	"path"
)

// serveTemplate responds with text/html content of the executed template
// found under request base path.
// 'home' template is assumed if request path ends with '/'.
func serveTemplate(w http.ResponseWriter, r *http.Request) {
	wantsPartial := len(r.FormValue("partial")) > 0
	tplname := path.Base(r.URL.Path)
	if tplname == "." || tplname == "/" {
		tplname = "home"
	}
	w.Header().Set("Content-Type", "text/html;charset=utf-8")
	err := renderTemplate(w, tplname, wantsPartial)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}
