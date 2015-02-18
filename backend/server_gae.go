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

	"appengine"
	"appengine/urlfetch"
	"appengine/user"
)

func init() {
	if err := initConfig("server.config", ""); err != nil {
		panic("initConfig: " + err.Error())
	}
	if err := initTemplates(); err != nil {
		panic("initTemplates: " + err.Error())
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
func allowPassthrough(ac appengine.Context, r *http.Request) bool {
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
		ac := appengine.NewContext(r)
		if allowPassthrough(ac, r) {
			h.ServeHTTP(w, r)
			return
		}

		u := user.Current(ac)
		if u == nil {
			url, err := user.LoginURL(ac, r.URL.Path)
			if err != nil {
				ac.Errorf("user.LoginURL(%q): %v", r.URL.Path, err)
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			http.Redirect(w, r, url, http.StatusFound)
			return
		}
		if !isWhitelisted(u.Email) {
			ac.Errorf("%s is not whitelisted", u.Email)
			http.Error(w, "Access denied, sorry. Try with a different account.", http.StatusForbidden)
			return
		}

		h.ServeHTTP(w, r)
	})
}

// newContext returns a newly created context of the in-flight request r.
// and its response writer w.
func newContext(r *http.Request, w io.Writer) context.Context {
	ac := appengine.NewContext(r)
	c := context.WithValue(context.Background(), ctxKeyGAEContext, ac)
	return context.WithValue(c, ctxKeyWriter, w)
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
	return cred.TokenSource(appengineContext(c)), nil
}

// httpTransport returns a suitable HTTP transport for current backend hosting environment.
// In this GAE-hosted version it uses appengine/urlfetch#Transport.
func httpTransport(c context.Context) http.RoundTripper {
	return &urlfetch.Transport{Context: appengineContext(c)}
}

// logf logs an info message using appengine's context.
func logf(c context.Context, format string, args ...interface{}) {
	appengineContext(c).Infof(format, args...)
}

// errorf logs an error message using appengine's context.
func errorf(c context.Context, format string, args ...interface{}) {
	appengineContext(c).Errorf(format, args...)
}
