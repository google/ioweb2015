// Copyright 2015 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
	"time"

	jwt "github.com/dgrijalva/jwt-go"
)

func TestVerifyBearerToken(t *testing.T) {
	defer resetTestState(t)
	defer preserveConfig()()
	const (
		token  = "fake-token"
		user   = "user-id-123"
		client = "my-client-id"
	)

	table := []struct {
		resp    string
		code    int
		success bool
	}{
		{fmt.Sprintf(`{"issued_to": %q, "user_id": %q, "expires_in": 3600}`, client, user), 200, true},
		{fmt.Sprintf(`{"issued_to": "other", "user_id": %q, "expires_in": 3600}`, user), 200, false},
		{fmt.Sprintf(`{"issued_to": %q, "user_id": %q, "expires_in": 0}`, client, user), 200, false},
		{fmt.Sprintf(`{"error": "bad request"}`), 400, false},
		{fmt.Sprintf(`{"random": "junk"}`), 200, false},
	}

	for i, test := range table {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if v := r.FormValue("access_token"); v != token {
				t.Errorf("access_token = %q; want %q", v, token)
			}
			w.WriteHeader(test.code)
			w.Header().Set("Content-Type", "application/json")
			fmt.Fprintf(w, test.resp)
		}))
		defer ts.Close()

		config.Google.Auth.Client = client
		config.Google.VerifyURL = ts.URL

		r := newTestRequest(t, "GET", "/", nil)
		uid, err := verifyBearerToken(newContext(r), token)

		switch {
		case test.success && err != nil:
			t.Errorf("%d: verifyBearerToken: %v", i, err)
		case test.success && uid != user:
			t.Errorf("%d: verifyBearerToken: uid = %q; want %q", i, uid, user)
		case !test.success && err == nil:
			t.Errorf("%d: verifyBearerToken: %v; want error", i, uid)
		}
	}
}

func TestVerifyIDToken(t *testing.T) {
	// TODO: test for invalid claims, e.g. iss, aud, azp, exp.
	defer resetTestState(t)
	defer preserveConfig()()
	const certID = "test-cert"
	key, cert := jwsTestKey(time.Now(), time.Now().Add(24*time.Hour))

	token := jwt.New(jwt.GetSigningMethod("RS256"))
	token.Header["kid"] = certID
	token.Claims = map[string]interface{}{
		"iss": "accounts.google.com",
		"exp": time.Now().Add(2 * time.Hour).Unix(),
		"aud": testClientID,
		"azp": testClientID,
		"sub": testUserID,
	}
	idToken, err := token.SignedString(key)
	if err != nil {
		t.Fatalf("token.SignedString: %v", err)
	}

	done := make(chan struct{}, 1)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"invalid": "junk", "%s": %q}`, certID, cert)
		done <- struct{}{}
	}))
	defer ts.Close()
	config.Google.CertURL = ts.URL

	r := newTestRequest(t, "GET", "/", nil)
	c := newContext(r)
	cache.flush(c)
	uid, err := verifyIDToken(c, idToken)

	if err != nil {
		t.Errorf("verifyIDToken(%q): %v", idToken, err)
	}
	if uid != testUserID {
		t.Errorf("uid = %q; want %q", uid, testUserID)
	}

	select {
	case <-done:
		// passed
	default:
		t.Errorf("certs were never fetched")
	}
}

func TestAuthUser(t *testing.T) {
	defer preserveConfig()()
	table := []struct {
		token              string
		verifyURL, certURL string
		success            bool
	}{
		{"bearer valid-token", config.Google.VerifyURL, "invalid-url", true},
		{"bearer " + testIDToken, "invalid-url", config.Google.CertURL, true},
		{"bearer it-doesnt-matter", "invalid-url", "invalid-url", false},
		{"invalid", config.Google.VerifyURL, config.Google.CertURL, false},
		{"", config.Google.VerifyURL, config.Google.CertURL, false},
	}

	for i, test := range table {
		config.Google.VerifyURL = test.verifyURL
		config.Google.CertURL = test.certURL

		c := newContext(newTestRequest(t, "GET", "/", nil))
		cache.flush(c)
		c, err := authUser(c, test.token)

		switch {
		case test.success && err != nil:
			t.Errorf("%d: authUser(%q): %v", i, test.token, err)
		case !test.success && err == nil:
			t.Errorf("%d: authUser(%q): %v; want error", i, test.token, contextUser(c))
		case test.success && err == nil && contextUser(c) != testUserID:
			t.Errorf("%d: authUser(%q): %v; want %q", i, test.token, contextUser(c), testUserID)
		}
	}
}

func TestTokenRefresher(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	c := newContext(newTestRequest(t, "GET", "/", nil))
	cred := &oauth2Credentials{
		userID:       "uid-123",
		Expiry:       time.Now(),
		AccessToken:  "dummy-access",
		RefreshToken: "dummy-refresh",
	}
	if err := storeCredentials(c, cred); err != nil {
		t.Fatal(err)
	}

	done := make(chan struct{}, 1)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if v := r.FormValue("client_id"); v != "my-client" {
			t.Errorf("client_id = %q; want my-client", v)
		}
		if v := r.FormValue("client_secret"); v != "my-secret" {
			t.Errorf("client_secret = %q; want my-secret", v)
		}
		if v := r.FormValue("refresh_token"); v != "dummy-refresh" {
			t.Errorf("refresh_token = %q; want dummy-refresh", v)
		}
		if v := r.FormValue("grant_type"); v != "refresh_token" {
			t.Errorf("grant_type = %q; want refresh_token", v)
		}

		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{
			"access_token":"new-access-token",
			"expires_in":3600,
			"token_type":"Bearer"
		}`))

		done <- struct{}{}
	}))
	defer ts.Close()
	config.Google.TokenURL = ts.URL
	config.Google.Auth.Client = "my-client"
	config.Google.Auth.Secret = "my-secret"

	tok, err := cred.tokenSource(c).Token()
	if err != nil {
		t.Fatalf("cred.tokenSource().Token: %v", err)
	}
	if tok.AccessToken != "new-access-token" {
		t.Errorf("tok.AccessToken = %q; want new-access-token", tok.AccessToken)
	}
	if cred.AccessToken != tok.AccessToken {
		t.Errorf("cred.AccessToken = %q; want %q", cred.AccessToken, tok.AccessToken)
	}
	if cred.RefreshToken == "" {
		t.Errorf("cred.RefreshToken is empty")
	}
	if !cred.Expiry.After(time.Now()) {
		t.Errorf("cred.Expiry is in the past: %s", cred.Expiry)
	}

	select {
	case <-done:
		// passed
	default:
		t.Errorf("refresh never happened")
	}

	// TODO: remove when standalone DB is implemented
	if !isGAEtest {
		return
	}

	cred2, err := getCredentials(c, "uid-123")
	if err != nil {
		t.Fatal(err)
	}
	if reflect.DeepEqual(cred2, cred) {
		t.Errorf("cred2 = %+v; want %+v", cred2, cred)
	}
}

func TestTokenRefresherRevoked(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	c := newContext(newTestRequest(t, "GET", "/", nil))
	cred := &oauth2Credentials{
		userID:       "uid-123",
		Expiry:       time.Now(),
		AccessToken:  "dummy-access",
		RefreshToken: "dummy-refresh",
	}
	if err := storeCredentials(c, cred); err != nil {
		t.Fatal(err)
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(`{"error": "invalid_grant"}`))
	}))
	defer ts.Close()
	config.Google.TokenURL = ts.URL

	_, err := cred.tokenSource(c).Token()
	if err != errAuthInvalid {
		t.Errorf("err = %v; want errAuthInvalid", err)
	}

	cred2, err := getCredentials(c, "uid-123")
	if err != nil {
		t.Fatal(err)
	}
	if cred2.RefreshToken != "" {
		t.Errorf("cred2.RefreshToken = %q; want ''", cred2.RefreshToken)
	}
}

func TestTokenRefresherMissing(t *testing.T) {
	defer resetTestState(t)

	cred := &oauth2Credentials{
		userID:       "uid-123",
		Expiry:       time.Now(),
		AccessToken:  "dummy-access",
		RefreshToken: "",
	}

	c := newContext(newTestRequest(t, "GET", "/dummy", nil))
	tok, err := cred.tokenSource(c).Token()

	if err != errAuthMissing {
		t.Errorf("err = %v, tok = %v; want errAuthMissing", tok, err)
	}
}
