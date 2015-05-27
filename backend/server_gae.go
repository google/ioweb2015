// Copyright 2015 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// This file is used only when compiled with GAE support.
// GAE-based backend serves only templates.

// +build appengine

package main

import (
	"net/http"
	"path"
	"strings"
	"time"

	"golang.org/x/net/context"

	"google.golang.org/appengine"
	"google.golang.org/appengine/log"
	"google.golang.org/appengine/urlfetch"
	"google.golang.org/appengine/user"
)

// allow requests prefixed with passthruPrefixes to bypass checkWhitelist
var passthruPrefixes = []string{
	"/manifest.json",
	"/sync",
	"/api/v1/user",
	"/api/v1/easter-egg",
}

func init() {
	if err := initConfig("server.config", ""); err != nil {
		panic("initConfig: " + err.Error())
	}
	// prepend config.Prefix to bypass prefixes
	for i, p := range passthruPrefixes {
		passthruPrefixes[i] = path.Join(config.Prefix, p)
	}
	// use built-in memcache service
	cache = &gaeMemcache{}
	// apps hosted on GAE use a different HTTP transport
	httpTransport = func(c context.Context) http.RoundTripper {
		c, _ = context.WithTimeout(c, 10*time.Second)
		return &urlfetch.Transport{Context: c}
	}
	// allow access only by whitelisted people/domains if not empty
	if len(config.Whitelist) > 0 {
		wrapHandler = checkWhitelist
	}
	rootHandleFn = serveTemplate
	registerHandlers()
	// site admin stuff, accessible only to config.Admins, only on GAE atm.
	aroot := path.Join(config.Prefix, "admin") + "/"
	http.Handle(aroot, checkAdmin(handler(handleAdmin)))
}

// allowPassthrough returns true if the request r can be handled w/o whitelist check.
// Currently, only GAE Cron and Task Queue jobs are allowed.
func allowPassthrough(r *http.Request) bool {
	if r.Header.Get("x-appengine-cron") == "true" || r.Header.Get("x-appengine-taskname") != "" {
		return true
	}
	for _, p := range passthruPrefixes {
		if strings.HasPrefix(r.URL.Path, p) {
			return true
		}
	}
	return false
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
			handleGAEAuth(w, r)
		}
	})
}

// checkAdmin is similar to checkWhitelist with the following exceptions:
// - doesn't test allowPassthrough()
// - looks up user emails in config.Admins instead of config.Whitelist.
func checkAdmin(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c := appengine.NewContext(r)
		u := user.Current(c)
		switch {
		case u != nil && isAdmin(u.Email):
			h.ServeHTTP(w, r)
		case u != nil:
			errorf(c, "%s is not admin", u.Email)
			http.Error(w, "Admins only, sorry. Try with a different account.", http.StatusForbidden)
		default:
			handleGAEAuth(w, r)
		}
	})
}

// handleGAEAuth sends a redirect to GAE authentication page.
func handleGAEAuth(w http.ResponseWriter, r *http.Request) {
	c := appengine.NewContext(r)
	url, err := user.LoginURL(c, r.URL.String())
	if err != nil {
		errorf(c, "user.LoginURL(%q): %v", r.URL.String(), err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	http.Redirect(w, r, url, http.StatusFound)
}

// newContext returns a context of the in-flight request r.
func newContext(r *http.Request) context.Context {
	return appengine.NewContext(r)
}

// logf logs an info message using appengine's context.
func logf(c context.Context, format string, args ...interface{}) {
	log.Infof(c, format, args...)
}

// errorf logs an error message using appengine's context.
func errorf(c context.Context, format string, args ...interface{}) {
	log.Errorf(c, format, args...)
}
