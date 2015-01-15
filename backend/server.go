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
	rootDir    string
	listenAddr string
	// app environment: "dev", "stage" or "prod"
	// don't refer to this directly, use env(c) func instead.
	appEnv string
)

// main is the entry point of the standalone server.
func main() {
	appEnv = os.Getenv("APP_ENV")
	if appEnv == "" {
		appEnv = "dev"
	}
	flag.StringVar(&rootDir, "d", "app", "app root dir")
	flag.StringVar(&listenAddr, "listen", "127.0.0.1:8080", "address to listen on")
	flag.StringVar(&appEnv, "env", appEnv, "app environment: dev, stage or prod")
	flag.Parse()

	cache = newMemoryCache()

	http.HandleFunc("/", withLogging(catchAllHandler))
	http.HandleFunc("/api/extended", withLogging(serveIOExtEntries))

	log.Fatal(http.ListenAndServe(listenAddr, nil))
}

// catchAllHandler serves either static content from rootDir
// or responds with a rendered template if no static asset found
// under the in-flight request.
func catchAllHandler(w http.ResponseWriter, r *http.Request) {
	p := path.Clean("/" + r.URL.Path)
	if p == "/" {
		p += "index"
	}
	p = filepath.Join(rootDir, filepath.FromSlash(p))

	if _, err := os.Stat(p); os.IsNotExist(err) {
		serveTemplate(w, r)
		return
	}

	http.ServeFile(w, r, p)
}

// withLogging wraps handler func h into a closure that logs
// incoming requests and passes it on to h.
func withLogging(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s", r.Method, r.URL.Path)
		h(w, r)
	}
}

// newContext returns a newly created context of the in-flight request r.
func newContext(r *http.Request) context.Context {
	return context.WithValue(context.Background(), ctxKeyEnv, appEnv)
}
