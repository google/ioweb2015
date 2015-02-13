// This file is used only when compiled without GAE support.
// The standalone backend serves both static assets and templates.

// +build !appengine

package main

import (
	"errors"
	"flag"
	"io"
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
	flagConfig = flag.String("c", "server.config", "backend config file path")
	flagEnv    = flag.String("env", "", "app environment: dev, stage or prod")
	flagDir    = flag.String("dir", "", "app root dir")
	flagAddr   = flag.String("addr", "", "address to listen on for standalone server")
	flagPrefix = flag.String("prefix", "", "URL path prefix to serve from")
)

// main is the entry point of the standalone server.
func main() {
	flag.Parse()
	initConfig(*flagConfig, *flagEnv, *flagDir, *flagAddr, *flagPrefix)
	cache = newMemoryCache()

	wrapHandler = logHandler
	handle("/", catchAllHandler)
	handle("/api/extended", serveIOExtEntries)
	handle("/api/social", serveSocial)
	// setup root redirect if we're prefixed
	if config.Prefix != "/" {
		redirect := http.HandlerFunc(redirectHandler)
		http.Handle("/", wrapHandler(redirect))
	}

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

// newContext returns a newly created context of the in-flight request r
// and its response writer w.
func newContext(r *http.Request, w io.Writer) context.Context {
	return context.WithValue(context.Background(), ctxKeyWriter, w)
}

// serviceCredentials returns a token source for the service account serviceAccountEmail.
func serviceCredentials(c context.Context, scopes ...string) (oauth2.TokenSource, error) {
	if config.Google.ServiceAccount.Key == "" || config.Google.ServiceAccount.Email == "" {
		return nil, errors.New("serviceCredentials: key or email is empty")
	}
	cred := &jwt.Config{
		Email:      config.Google.ServiceAccount.Email,
		PrivateKey: []byte(config.Google.ServiceAccount.Key),
		Scopes:     scopes,
		TokenURL:   config.Google.TokenURL,
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
