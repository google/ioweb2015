// +build appengine

package main

import (
	"bytes"
	"encoding/gob"
	"errors"
	"time"

	"golang.org/x/net/context"
	"google.golang.org/appengine/datastore"
)

const (
	kindCredentials = "Cred"
	kindUserPush    = "Push"
	kindEventData   = "EventData"
)

// RunInTransaction runs f in a transaction.
// It calls f with a transaction context tc that f should use for all operations.
func RunInTransaction(c context.Context, f func(context.Context) error) error {
	opts := &datastore.TransactionOptions{XG: true}
	return datastore.RunInTransaction(c, f, opts)
}

// storeCredentials saves OAuth2 credentials cred in a presistent DB.
// cred must have userID set to a non-zero value.
func storeCredentials(c context.Context, cred *oauth2Credentials) error {
	if cred.userID == "" {
		return errors.New("storeCredentials: userID is not set")
	}

	key := datastore.NewKey(c, kindCredentials, cred.userID, 0, nil)
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

// storeUserPushInfo saves user push configuration in a persistent DB.
// info must have userID set to a non-zero value.
func storeUserPushInfo(c context.Context, p *userPush) error {
	if p.userID == "" {
		return errors.New("storeUserPushInfo: userID is not set")
	}

	key := datastore.NewKey(c, kindUserPush, p.userID, 0, nil)
	_, err := datastore.Put(c, key, p)
	return err
}

// getUserPushInfo fetches user push configuration from a persistent DB.
// If the configuration does not exist yet, a default one is returned.
// Default configuration has all notification settings disabled.
// A user must be present in the context.
func getUserPushInfo(c context.Context) (*userPush, error) {
	user := contextUser(c)
	if user == "" {
		return nil, errors.New("getUserPushInfo: no user in context")
	}

	key := datastore.NewKey(c, kindUserPush, user, 0, nil)
	p := &userPush{userID: user}
	err := datastore.Get(c, key, p)
	if err == datastore.ErrNoSuchEntity {
		err = nil
	}
	if err != nil {
		return nil, err
	}

	if p.Ext.Enabled {
		p.Pext = &p.Ext
	}
	return p, err
}

func storeEventData(c context.Context, d *eventData) error {
	var b bytes.Buffer
	if err := gob.NewEncoder(&b).Encode(d); err != nil {
		return err
	}
	// TODO: handle a case where b.Bytes() is > 1Mb
	ent := &struct {
		Timestamp time.Time `datastore:"ts"`
		Bytes     []byte    `datastore:"data"`
	}{d.modified, b.Bytes()}
	key := datastore.NewIncompleteKey(c, kindEventData, eventDataParent(c))
	_, err := datastore.Put(c, key, ent)
	return err
}

func getLatestEventData(c context.Context) (*eventData, error) {
	q := datastore.NewQuery(kindEventData).
		Ancestor(eventDataParent(c)).
		Order("-ts").
		Limit(1)

	var res []*struct {
		Timestamp time.Time `datastore:"ts"`
		Bytes     []byte    `datastore:"data"`
	}
	if _, err := q.GetAll(c, &res); err != nil {
		return nil, err
	}

	data := &eventData{}
	if len(res) == 0 {
		return data, nil
	}
	err := gob.NewDecoder(bytes.NewReader(res[0].Bytes)).Decode(data)
	data.modified = res[0].Timestamp
	return data, err
}

func storeDataChanges(c context.Context, d *dataChanges) error {
	return errors.New("not implemented")
}

func eventDataParent(c context.Context) *datastore.Key {
	return datastore.NewKey(c, kindEventData, "root", 0, nil)
}
