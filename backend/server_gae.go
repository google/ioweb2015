// This file is used only when compiled with GAE support.
// GAE-based backend serves only templates.

// +build appengine

package main

import "net/http"

// rootDir is relative to basedir of app.yaml is (app root)
var rootDir = "app"

func init() {
	//rootDir = filepath.Dir(os.Args[0])
	http.HandleFunc("/", serveTemplate)
}
