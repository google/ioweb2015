// This file is used only when compiled without GAE support.
// The standalone backend serves both static assets and templates.

// +build !appengine

package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path"
	"path/filepath"
)

var (
	rootDir    string
	listenAddr string
	appEnv     string
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

	http.HandleFunc("/", catchAllHandler)

	log.Fatal(http.ListenAndServe(listenAddr, nil))
}

// catchAllHandler serves either static content from rootDir
// or responds with a rendered template if no static asset found
// under the in-flight request.
func catchAllHandler(w http.ResponseWriter, r *http.Request) {
	logmsg := fmt.Sprintf("%s %s", r.Method, r.URL.Path)
	defer func() {
		log.Println(logmsg)
	}()

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

// env returns current app environment: "dev", "stage" or "prod".
// The environment is determined by either APP_ENV process environment
// or '-env' command line flag.
func env(_ *http.Request) string {
	// Request arg is accepted to make the func compatible
	// with GAE version.
	return appEnv
}
