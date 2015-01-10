// This file is used only when compiled with GAE support.
// GAE-based backend serves only templates.

// +build appengine

package main

import (
	"net/http"
	"strings"

	"appengine"
)

// rootDir is relative to basedir of app.yaml is (app root)
var rootDir = "app"

func init() {
	http.HandleFunc("/", serveTemplate)
}

// env returns current app environment: "dev", "stage" or "prod".
// The environment is determined by the app version which request r
// was routed to:
//   "-prod" suffix results into "prod" env
//   "-stage" suffix results into "stage"
//   default is "dev"
// App version is speicified in app.yaml.
func env(r *http.Request) string {
	c := appengine.NewContext(r)
	v := appengine.VersionID(c)
	if i := strings.Index(v, "."); i > 0 {
		v = v[:i]
	}
	switch {
	case strings.HasSuffix(v, "-prod"):
		return "prod"
	case strings.HasSuffix(v, "-stage"):
		return "stage"
	}
	return "dev"
}
