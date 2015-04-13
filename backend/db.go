// +build !appengine

// TODO: implement using Bolt: https://github.com/boltdb/bolt

package main

import (
	"errors"

	"golang.org/x/net/context"
)

// storeCredentials saves OAuth2 credentials cred in a presistent DB.
// cred must have userID set to a non-zero value.
func storeCredentials(c context.Context, cred *oauth2Credentials) error {
	// TODO: implement
	return nil
}

// getCredentials fetches credentials from a persistent DB.
// A user must be present in the context.
func getCredentials(c context.Context) (*oauth2Credentials, error) {
	// TODO: implement
	return nil, errors.New("not implemented")
}
