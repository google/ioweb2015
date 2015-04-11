// +build appengine

package main

import (
	"errors"

	"golang.org/x/net/context"
	"google.golang.org/appengine/datastore"
)

const (
	kindCredentials = "Cred"
)

// storeCredentials saves OAuth2 credentials cred in a presistent DB.
// A user must be present in the context.
func storeCredentials(c context.Context, cred *oauth2Credentials) error {
	user := contextUser(c)
	if user == "" {
		return errors.New("no user in context")
	}

	key := datastore.NewKey(c, kindCredentials, user, 0, nil)
	_, err := datastore.Put(c, key, cred)
	return err
}

// getCredentials fetches credentials from a persistent DB.
// A user must be present in the context.
func getCredentials(c context.Context) (*oauth2Credentials, error) {
	user := contextUser(c)
	if user == "" {
		return nil, errors.New("no user in context")
	}

	key := datastore.NewKey(c, kindCredentials, user, 0, nil)
	cred := &oauth2Credentials{userID: user}
	return cred, datastore.Get(c, key, cred)
}
