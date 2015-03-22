package main

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"strings"

	"golang.org/x/net/context"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/jwt"
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
	req, _ := http.NewRequest("POST", config.Twitter.TokenURL, strings.NewReader(params.Encode()))
	req.Header.Set("Authorization", "Basic "+basic)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	hc := &http.Client{Transport: t.transport}
	resp, err := hc.Do(req)
	if err != nil {
		return nil, fmt.Errorf("twitterCredentials: %v", err)
	}
	defer resp.Body.Close()
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("twitterCredentials: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("twitterCredentials: got %d status", resp.StatusCode)
	}

	token := &struct {
		AccessToken string `json:"access_token"`
	}{}
	if err := json.Unmarshal(body, token); err != nil {
		return nil, err
	}
	if token.AccessToken == "" {
		return nil, errors.New("twitterCredentials: empty access token")
	}
	return &oauth2.Token{AccessToken: token.AccessToken}, nil
}

// twitterClient creates a new HTTP client with oauth2Transport.
func twitterClient(c context.Context) (*http.Client, error) {
	cred := &twitterCredentials{
		key:       config.Twitter.Key,
		secret:    config.Twitter.Secret,
		transport: httpTransport(c),
		cache:     cache,
	}
	return &http.Client{Transport: oauth2Transport(c, cred)}, nil
}

// serviceAccountClient creates a new HTTP client with an access token
// obtained using the service account config.Google.ServiceAccount.
func serviceAccountClient(c context.Context, scopes ...string) (*http.Client, error) {
	cred, err := serviceCredentials(c, scopes...)
	if err != nil {
		return nil, err
	}
	return &http.Client{Transport: oauth2Transport(c, cred)}, nil
}

// serviceCredentials returns a token source for config.Google.ServiceAccount.
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

// oauth2Transport returns an HTTP transport suitable for making OAuth2-ed requests.
func oauth2Transport(c context.Context, s oauth2.TokenSource) http.RoundTripper {
	return &oauth2.Transport{
		Source: s,
		Base:   httpTransport(c),
	}
}
