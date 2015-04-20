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
	"sync"
	"time"

	"golang.org/x/net/context"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/jwt"
)

var (
	errAuthMissing = errors.New("authorization required")
	errAuthInvalid = errors.New("mismatched or malformed authorization")
)

const (
	// Authorization header prefix
	bearerHeader    = "bearer "
	bearerHeaderLen = len(bearerHeader)
)

// oauth2Credentials is a user authorization credentials.
type oauth2Credentials struct {
	sync.Mutex   // locks credentials during refresh token process
	userID       string
	Expiry       time.Time `datastore:"exp"`
	AccessToken  string    `datastore:"at,noindex"`
	RefreshToken string    `datastore:"rt,noindex"`
}

// tokenSource returns a reusable oauth2.TokenSource.
// When expired, a new token will be obtained using cred.RefreshToken
// and stored in a persistent db.
// The returned TokenSource valid only within provided context c.
func (cred *oauth2Credentials) tokenSource(c context.Context) oauth2.TokenSource {
	t := &oauth2.Token{
		AccessToken: cred.AccessToken,
		Expiry:      cred.Expiry,
	}
	return oauth2.ReuseTokenSource(t, &tokenRefresher{c, cred})
}

// tokenRefresher implements oauth2.TokenSource for oauth2Credentials.
type tokenRefresher struct {
	ctx  context.Context
	cred *oauth2Credentials
}

// Token returns a new access token using tr.cred.RefreshToken
// It also updates its tr.cred and stores new token with storeCredentials().
func (tr *tokenRefresher) Token() (*oauth2.Token, error) {
	if tr.cred.RefreshToken == "" {
		return nil, errors.New("tokenRefresher: refresh token is not set")
	}
	tr.cred.Lock()
	defer tr.cred.Unlock()

	params := url.Values{
		"client_id":     {config.Google.Auth.Client},
		"client_secret": {config.Google.Auth.Secret},
		"refresh_token": {tr.cred.RefreshToken},
		"grant_type":    {"refresh_token"},
	}
	res, err := httpClient(tr.ctx).PostForm(config.Google.TokenURL, params)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return nil, fmt.Errorf("tokenRefresher: %v", err)
	}
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("tokenRefresher: %s; %s", res.Status, body)
	}

	var t struct {
		Token  string `json:"access_token"`
		Expiry int    `json:"expires_in"`
	}
	if err := json.Unmarshal(body, &t); err != nil {
		return nil, fmt.Errorf("tokenRefresher: %v", err)
	}

	tr.cred.AccessToken = t.Token
	tr.cred.Expiry = time.Now().Add(time.Duration(t.Expiry) * time.Second)
	if err := storeCredentials(tr.ctx, tr.cred); err != nil {
		errorf(tr.ctx, "tokenRefresher: %v", err)
	}
	return &oauth2.Token{
		AccessToken: tr.cred.AccessToken,
		Expiry:      tr.cred.Expiry,
	}, nil
}

// authUser verifies authentication provided in bearer.
// bearer must be formatted as "bearer <token>",
// where <token> is either a Bearer or ID (JWT) token. The latter is preferred.
// The func returns context c in case of an error, otherwise a new one minted with the user ID.
func authUser(c context.Context, bearer string) (context.Context, error) {
	if bearer == "" {
		return c, errAuthInvalid
	}
	if len(bearer) < bearerHeaderLen || strings.ToLower(bearer[:bearerHeaderLen]) != bearerHeader {
		return c, errAuthMissing
	}
	bearer = bearer[bearerHeaderLen:]
	userID, err := verifyIDToken(c, bearer)
	if err != nil {
		userID, err = verifyBearerToken(c, bearer)
	}
	if err != nil {
		return c, errAuthInvalid
	}
	return context.WithValue(c, ctxKeyUser, userID), nil
}

// verifyBearerToken verifies the standard OAuth 2.0 Bearer token.
// It returns user ID of the principal who granted an authorization.
func verifyBearerToken(c context.Context, t string) (string, error) {
	p := url.Values{"access_token": {t}}
	hc := httpClient(c)
	// TODO: figure out the rate limit to tokeninfo and bump it up if needed.
	res, err := hc.PostForm(config.Google.VerifyURL, p)
	if err != nil {
		return "", err
	}
	if res.StatusCode != http.StatusOK {
		return "", fmt.Errorf("verifyBearerToken (%q): remote says: %s", t, res.Status)
	}
	defer res.Body.Close()
	var body struct {
		ClientID string `json:"issued_to"`
		UserID   string `json:"user_id"`
		Expiry   int    `json:"expires_in"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		return "", err
	}
	if body.ClientID != config.Google.Auth.Client {
		return "", fmt.Errorf("verifyBearerToken: issued_to %q; want %q",
			body.ClientID, config.Google.Auth.Client)
	}
	if body.Expiry <= 0 {
		return "", errors.New("verifyBearerToken: expired token")
	}
	return body.UserID, nil
}

// fetchCredentials exchanges one-time authorization code for access and refresh tokens.
// Context c is required to contain a non-empty user ID under ctxKeyUser,
// normally obtained by authUser().
func fetchCredentials(c context.Context, code string) (*oauth2Credentials, error) {
	// exchange code for access tokens
	p := url.Values{
		"code":          {code},
		"client_id":     {config.Google.Auth.Client},
		"client_secret": {config.Google.Auth.Secret},
		"redirect_uri":  {"postmessage"},
		"grant_type":    {"authorization_code"},
	}
	hc := httpClient(c)
	res, err := hc.PostForm(config.Google.TokenURL, p)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		er, _ := ioutil.ReadAll(res.Body)
		errorf(c, "fetchCredentials: %s", er)
		return nil, fmt.Errorf("fetchCredentials: remote says: %s", res.Status)
	}
	var body struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		IdToken      string `json:"id_token"`
		Expires      int    `json:"expires_in"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		return nil, err
	}
	if body.RefreshToken == "" {
		return nil, errors.New("fetchCredentials: not offline; refresh token is not set")
	}
	// verify that in-flight user ID and received token's user ID match
	// prefer ID tokens, because they're faster
	var userID string
	if body.IdToken != "" {
		userID, err = verifyIDToken(c, body.IdToken)
	} else {
		userID, err = verifyBearerToken(c, body.AccessToken)
	}
	if err != nil {
		return nil, err
	}
	if userID != contextUser(c) {
		return nil, fmt.Errorf("userID = %s; want %s", userID, contextUser(c))
	}
	// use only what we need
	return &oauth2Credentials{
		userID:       userID,
		Expiry:       time.Now().Add(time.Duration(body.Expires) * time.Second),
		AccessToken:  body.AccessToken,
		RefreshToken: body.RefreshToken,
	}, nil
}

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
