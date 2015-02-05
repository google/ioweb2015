package main

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"net/url"
	"strings"

	"golang.org/x/net/context"
	"golang.org/x/oauth2"
)

const (
	// serviceAccountEmail is the identity of the backend app.
	serviceAccountEmail = "835117351912-gntnm0o6adtmk2j65tn9btku18a33ai3@developer.gserviceaccount.com"

	// googleTokenURL is a Google OAuth2 endpoint for both Bearer and JWT tokens.
	googleTokenURL = "https://accounts.google.com/o/oauth2/token"
	// twitterTokenURL is a Twitter endpoint for App Authentication (OAuth2).
	twitterTokenURL = "https://api.twitter.com/oauth2/token"
)

// twitterCredentials implements oauth2.TokenSource for Twitter App authentication.
type twitterCredentials struct {
	key, secret string
	transport   http.RoundTripper
	cache       cacheInterface
}

// Token fetches a new token using Twitter App authentication.
func (t *twitterCredentials) Token() (*oauth2.Token, error) {
	if t.key == "" || t.secret == "" {
		return nil, errors.New("twitterCredentials: empty key or secret")
	}
	basic := t.key + ":" + t.secret
	basic = base64.StdEncoding.EncodeToString([]byte(basic))

	params := url.Values{"grant_type": {"client_credentials"}}
	req, _ := http.NewRequest("POST", twitterTokenURL, strings.NewReader(params.Encode()))
	req.Header.Set("Authorization", "Basic "+basic)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	hc := &http.Client{Transport: t.transport}
	resp, err := hc.Do(req)
	if err != nil {
		log.Fatal(err)
	}
	defer resp.Body.Close()
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Twitter auth replied with: %d", resp.StatusCode)
	}

	token := &struct {
		AccessToken string `json:"access_token"`
	}{}
	if err := json.Unmarshal(body, token); err != nil {
		return nil, err
	}
	if token.AccessToken == "" {
		return nil, errors.New("Got empty token from Twitter auth")
	}
	return &oauth2.Token{AccessToken: token.AccessToken}, nil
}

// oauth2Transport returns an HTTP transport suitable for making OAuth2-ed requests.
func oauth2Transport(c context.Context, s oauth2.TokenSource) http.RoundTripper {
	return &oauth2.Transport{
		Source: s,
		Base:   httpTransport(c),
	}
}

// serviceAccountClient creates a new HTTP client with an access token
// obtained using the service account backend/service-account.pem.
func serviceAccountClient(c context.Context, scopes ...string) (*http.Client, error) {
	cred, err := serviceCredentials(c, scopes...)
	if err != nil {
		return nil, err
	}
	return &http.Client{Transport: oauth2Transport(c, cred)}, nil
}

// twitterClient creates a new HTTP client with oauth2Transport.
func twitterClient(c context.Context) (*http.Client, error) {
	cred := &twitterCredentials{
		key:       config.TwitterKey,
		secret:    config.TwitterSecret,
		transport: httpTransport(c),
		cache:     cache,
	}
	return &http.Client{Transport: oauth2Transport(c, cred)}, nil
}
