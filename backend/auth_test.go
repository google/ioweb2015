package main

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	jwt "github.com/dgrijalva/jwt-go"
)

func TestVerifyBearerToken(t *testing.T) {
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

		r, _ := http.NewRequest("GET", "/", nil)
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

	r, _ := http.NewRequest("GET", "/", nil)
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

		r, _ := http.NewRequest("GET", "/", nil)
		c := newContext(r)
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
