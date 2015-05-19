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

// This file is used only when compiled without GAE support.
// The standalone backend serves both static assets and templates.

// +build !appengine

package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"path"
	"path/filepath"

	"golang.org/x/net/context"
)

var (
	flagConfig = flag.String("c", "server.config", "backend config file path")
	flagAddr   = flag.String("addr", "", "address to listen on for standalone server")
)

// main is the entry point of the standalone server.
func main() {
	flag.Parse()
	if err := initConfig(*flagConfig, *flagAddr); err != nil {
		panic("initConfig: " + err.Error())
	}

	cache = newMemoryCache()
	wrapHandler = logHandler
	rootHandleFn = catchAllHandler
	registerHandlers()

	if err := http.ListenAndServe(config.Addr, nil); err != nil {
		// don't need context here
		errorf(nil, "%v", err)
		os.Exit(1)
	}
}

// catchAllHandler serves either static content from rootDir
// or responds with a rendered template if no static asset found
// under the in-flight request.
func catchAllHandler(w http.ResponseWriter, r *http.Request) {
	p := path.Clean("/" + r.URL.Path)
	if p == "/" {
		p += "index"
	}
	p = filepath.Join(config.Dir, filepath.FromSlash(p))

	if _, err := os.Stat(p); os.IsNotExist(err) {
		serveTemplate(w, r)
		return
	}

	http.ServeFile(w, r, p)
}

// logHandler logs each request before handing it over to the handler h.
func logHandler(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// don't need context in standalone server
		logf(nil, "%s %s", r.Method, r.URL.Path)
		h.ServeHTTP(w, r)
	})
}

// newContext returns a context of the in-flight request r.
func newContext(r *http.Request) context.Context {
	return context.Background()
}

// logf logs an info message using Go's standard log package.
func logf(_ context.Context, format string, args ...interface{}) {
	log.Printf(format, args...)
}

// errorf logs an error message using Go's standard log package.
func errorf(_ context.Context, format string, args ...interface{}) {
	log.Printf("ERROR: "+format, args...)
}
