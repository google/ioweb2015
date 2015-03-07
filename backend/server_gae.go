// This file is used only when compiled with GAE support.
// GAE-based backend serves only templates.

// +build appengine

package main

import (
	"errors"
	"io"
	"net/http"

	"golang.org/x/net/context"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/jwt"

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
	wrapHandler = checkWhitelist
	handle("/", serveTemplate)
	handle("/api/extended", serveIOExtEntries)
	handle("/api/social", serveSocial)
	// setup root redirect if we're prefixed
	if config.Prefix != "/" {
		redirect := http.HandlerFunc(redirectHandler)
		http.Handle("/", wrapHandler(redirect))
	}
}

// allowPassthrough returns true if the request r can be handled w/o whitelist check.
func allowPassthrough(r *http.Request) bool {
	return isProd() ||
		r.Header.Get("X-AppEngine-Cron") == "true" ||
		r.Header.Get("X-AppEngine-TaskName") != ""
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
		ac := appengine.NewContext(r)
		u := user.Current(ac)
		if u == nil {
			url, err := user.LoginURL(ac, r.URL.Path)
			if err != nil {
				errorf(ac, "user.LoginURL(%q): %v", r.URL.Path, err)
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			http.Redirect(w, r, url, http.StatusFound)
			return
		}
		if !isWhitelisted(u.Email) {
			errorf(ac, "%s is not whitelisted", u.Email)
			http.Error(w, "Access denied, sorry. Try with a different account.", http.StatusForbidden)
			return
		}

		h.ServeHTTP(w, r)
	})
}

// newContext returns a newly created context of the in-flight request r.
// and its response writer w.
func newContext(r *http.Request, w io.Writer) context.Context {
	c := appengine.NewContext(r)
	return context.WithValue(c, ctxKeyWriter, w)
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
	return cred.TokenSource(c), nil
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
