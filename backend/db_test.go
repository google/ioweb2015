package main

import (
	"testing"
	"time"

	"golang.org/x/net/context"
)

func TestStoreGetCredentials(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}

	cred1 := &oauth2Credentials{
		userID:       "user-123",
		AccessToken:  "atoken",
		RefreshToken: "rtoken",
		Expiry:       time.Now(),
	}

	r := newTestRequest(t, "GET", "/", nil)
	c := context.WithValue(newContext(r), ctxKeyUser, "user-123")
	if err := storeCredentials(c, cred1); err != nil {
		t.Fatalf("storeCredentials: %v", err)
	}

	cred2, err := getCredentials(c)
	if err != nil {
		t.Fatalf("getCredentials: %v", err)
	}

	if cred2.userID != "user-123" {
		t.Errorf("cred2.userID = %q; want 'user-123'", cred2.userID)
	}
	if cred2.AccessToken != cred1.AccessToken {
		t.Errorf("cred2.AccessToken = %q; want %q", cred2.AccessToken, cred1.AccessToken)
	}
	if cred2.RefreshToken != cred1.RefreshToken {
		t.Errorf("cred2.RefreshToken = %q; want %q", cred2.RefreshToken, cred1.RefreshToken)
	}
	// nanosec may differ a bit
	if cred2.Expiry.Unix() != cred1.Expiry.Unix() {
		t.Errorf("cred2.Expiry = %s; want %s", cred2.Expiry, cred1.Expiry)
	}

	c = context.WithValue(newContext(r), ctxKeyUser, "random-user")
	v, err := getCredentials(c)
	if err == nil {
		t.Errorf("getCredentials: %+v; want error", v)
	}
}
