// This file is used only when compiled with GAE support.
// GAE-based backend serves only templates.

// +build appengine

package main

import (
	"net/http"
	"strings"

	"golang.org/x/net/context"

	"appengine"
)

// rootDir is relative to basedir of app.yaml is (app root)
var rootDir = "app"

func init() {
	cache = &gaeMemcache{}

	http.HandleFunc("/", serveTemplate)
	http.HandleFunc("/api/extended", serveIOExtEntries)
}

// newContext returns a newly created context of the in-flight request r.
func newContext(r *http.Request) context.Context {
	ac := appengine.NewContext(r)
	v := appengine.VersionID(ac)
	if i := strings.Index(v, "."); i > 0 {
		v = v[:i]
	}
	var appEnv string
	switch {
	default:
		appEnv = "dev"
	case strings.HasSuffix(v, "-prod"):
		appEnv = "prod"
	case strings.HasSuffix(v, "-stage"):
		appEnv = "stage"
	}
	c := context.WithValue(context.Background(), ctxKeyEnv, appEnv)
	return context.WithValue(c, ctxKeyGAEContext, ac)
}

// appengineContext extracts appengine.Context value from the context c
// associated with an in-flight request.
func appengineContext(c context.Context) appengine.Context {
	ac, ok := c.Value(ctxKeyGAEContext).(appengine.Context)
	if !ok || ac == nil {
		panic("never reached: no appengine.Context found")
	}
	return ac
}
