// This file is used only when compiled without GAE support.
// The standalone backend serves both static assets and templates.

// +build !appengine

package main

import (
	"flag"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"path"
	"path/filepath"

	"golang.org/x/net/context"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/jwt"
)

var (
	rootDir    = "app"
	listenAddr = "127.0.0.1:8080"
	// URL path prefix to serve from
	httpPrefix = "/io2015"
	// app environment: "dev", "stage" or "prod"
	// don't refer to this directly, use env(c) func instead.
	appEnv string
)

// init runs before main.
func init() {
	appEnv = os.Getenv("APP_ENV")
	if appEnv == "" {
		appEnv = "dev"
	}
	flag.StringVar(&rootDir, "d", rootDir, "app root dir")
	flag.StringVar(&listenAddr, "listen", listenAddr, "address to listen on")
	flag.StringVar(&httpPrefix, "prefix", httpPrefix, "URL path prefix to serve from")
	flag.StringVar(&appEnv, "env", appEnv, "app environment: dev, stage or prod")

	wrapHandler = logHandler
}

// main is the entry point of the standalone server.
func main() {
	flag.Parse()
	if httpPrefix == "" || httpPrefix[0] != '/' {
		httpPrefix = "/" + httpPrefix
	}

	initConfig()
	cache = newMemoryCache()

	handle("/", catchAllHandler)
	handle("/api/extended", serveIOExtEntries)
	handle("/api/social", serveSocial)
	// setup root redirect if we're prefixed
	if httpPrefix != "/" {
		redirect := http.HandlerFunc(redirectHandler)
		http.Handle("/", wrapHandler(redirect))
	}

	if err := http.ListenAndServe(listenAddr, nil); err != nil {
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
	p = filepath.Join(rootDir, filepath.FromSlash(p))

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

// newContext returns a newly created context of the in-flight request r
// and its response writer w.
func newContext(r *http.Request, w io.Writer) context.Context {
	c := context.WithValue(context.Background(), ctxKeyEnv, appEnv)
	return context.WithValue(c, ctxKeyWriter, w)
}

// serviceCredentials returns a token source for the service account serviceAccountEmail.
func serviceCredentials(c context.Context, scopes ...string) (oauth2.TokenSource, error) {
	keypath := filepath.Join(rootDir, "..", "service-account.pem")
	key, err := ioutil.ReadFile(keypath)
	if err != nil {
		return nil, err
	}

	cred := &jwt.Config{
		Email:      serviceAccountEmail,
		PrivateKey: key,
		Scopes:     scopes,
		TokenURL:   googleTokenURL,
	}
	return cred.TokenSource(oauth2.NoContext), nil
}

// httpTransport returns a suitable HTTP transport for current backend hosting environment.
// In this standalone version it simply returns http.DefaultTransport.
func httpTransport(c context.Context) http.RoundTripper {
	return http.DefaultTransport
}

// logf logs an info message using Go's standard log package.
func logf(_ context.Context, format string, args ...interface{}) {
	log.Printf(format, args...)
}

// errorf logs an error message using Go's standard log package.
func errorf(_ context.Context, format string, args ...interface{}) {
	log.Printf("ERROR: "+format, args...)
}
