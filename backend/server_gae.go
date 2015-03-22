// This file is used only when compiled with GAE support.
// GAE-based backend serves only templates.

// +build appengine

package main

import (
	"net/http"

	"golang.org/x/net/context"

	"google.golang.org/appengine"
	"google.golang.org/appengine/log"
	"google.golang.org/appengine/urlfetch"
	"google.golang.org/appengine/user"
)

func init() {
	if err := initConfig("server.config", ""); err != nil {
		panic("initConfig: " + err.Error())
	}
	cache = &gaeMemcache{}
	if isStaging() {
		wrapHandler = checkWhitelist
	}
	rootHandleFn = serveTemplate
	registerHandlers()
}

// allowPassthrough returns true if the request r can be handled w/o whitelist check.
// Currently, only GAE Cron and Task Queue jobs are allowed.
func allowPassthrough(r *http.Request) bool {
	return r.Header.Get("X-AppEngine-Cron") == "true" || r.Header.Get("X-AppEngine-TaskName") != ""
}

// checkWhitelist checks whether the current user is allowed to access
// handler h using isWhitelisted() func before handing over in-flight request.
// It redirects to GAE login URL if no user found or responds with 403
// (Forbidden) HTTP error code if the current user is not whitelisted.
func checkWhitelist(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if allowPassthrough(r) {
			h.ServeHTTP(w, r)
			return
		}
		c := appengine.NewContext(r)
		u := user.Current(c)
		switch {
		case u != nil && isWhitelisted(u.Email):
			h.ServeHTTP(w, r)
		case u != nil:
			errorf(c, "%s is not whitelisted", u.Email)
			http.Error(w, "Access denied, sorry. Try with a different account.", http.StatusForbidden)
		default:
			url, err := user.LoginURL(c, r.URL.Path)
			if err != nil {
				errorf(c, "user.LoginURL(%q): %v", r.URL.Path, err)
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			http.Redirect(w, r, url, http.StatusFound)
		}
	})
}

// newContext returns a context of the in-flight request r.
func newContext(r *http.Request) context.Context {
	return appengine.NewContext(r)
}

// httpTransport returns a suitable HTTP transport for current backend hosting environment.
// In this GAE-hosted version it uses appengine/urlfetch#Transport.
func httpTransport(c context.Context) http.RoundTripper {
	return &urlfetch.Transport{Context: c}
}

// logf logs an info message using appengine's context.
func logf(c context.Context, format string, args ...interface{}) {
	log.Infof(c, format, args...)
}

// errorf logs an error message using appengine's context.
func errorf(c context.Context, format string, args ...interface{}) {
	log.Errorf(c, format, args...)
}
