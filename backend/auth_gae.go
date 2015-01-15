// +build appengine

package main

import (
	"io/ioutil"
	"net/http"
	"path/filepath"

	"golang.org/x/net/context"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"golang.org/x/oauth2/jwt"

	"appengine/urlfetch"
)

// serviceAccountClient creates a new HTTP client with an access token
// obtained using the service account backend/service-account.pem.
func serviceAccountClient(c context.Context, scopes ...string) (*http.Client, error) {
	keypath := filepath.Join(rootDir, "..", "service-account.pem")
	key, err := ioutil.ReadFile(keypath)
	if err != nil {
		return nil, err
	}

	conf := &jwt.Config{
		Email:      "835117351912-gntnm0o6adtmk2j65tn9btku18a33ai3@developer.gserviceaccount.com",
		PrivateKey: key,
		Scopes:     scopes,
		TokenURL:   google.JWTTokenURL,
	}
	ac := appengineContext(c)
	hc := &http.Client{
		Transport: &oauth2.Transport{
			Source: conf.TokenSource(ac),
			Base:   &urlfetch.Transport{Context: ac},
		},
	}
	return hc, nil
}
