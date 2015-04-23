// +build appengine

package main

import (
	"bytes"
	"crypto/md5"
	"encoding/gob"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"golang.org/x/net/context"
	"google.golang.org/appengine/datastore"
)

const (
	kindCredentials = "Cred"
	kindUserPush    = "Push"
	kindEventData   = "EventData"
	kindChanges     = "Changes"
)

// TODO: merge this with errNotModified in db.go
var errNotModified = errors.New("content not modified")

// RunInTransaction runs f in a transaction.
// It calls f with a transaction context tc that f should use for all operations.
func runInTransaction(c context.Context, f func(context.Context) error) error {
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

// getCredentials fetches user credentials from a persistent DB.
func getCredentials(c context.Context, uid string) (*oauth2Credentials, error) {
	key := datastore.NewKey(c, kindCredentials, uid, 0, nil)
	cred := &oauth2Credentials{userID: uid}
	err := datastore.Get(c, key, cred)
	if err != nil {
		err = fmt.Errorf("getCredentials: %v", err)
	}
	return cred, err
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
func getUserPushInfo(c context.Context, uid string) (*userPush, error) {
	key := datastore.NewKey(c, kindUserPush, uid, 0, nil)
	p := &userPush{userID: uid}
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

// listUsersWithPush returns user IDs which have userPush.Enabled == true.
// It might not return most recent result because of the datastore eventual consistency.
func listUsersWithPush(c context.Context) ([]string, error) {
	users := make([]string, 0)
	q := datastore.NewQuery(kindUserPush).Filter("on =", true).KeysOnly()
	for t := q.Run(c); ; {
		k, err := t.Next(nil)
		if err == datastore.Done {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("listUsersWithPush: %v", err)
		}
		users = append(users, k.StringID())
	}
	return users, nil
}

// storeEventData saves d in the datastore with auto-generated ID
// and a common ancestor provided by eventDataParent().
// All fields are unindexed except for d.modified.
// Unexported fields other than d.modified are not stored.
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

// getLatestEventData fetches most recent version of eventData previously saved with storeEventData().
//
// etags adheres to rfc7232 semantics. If one of etags matches etag of the entity,
// an empty eventData with only etag and modified fields set is returned
// along with errNotModified error.
//
// This func guarantees for the returned eventData to have a non-zero value etag,
// unless no entities exist in the datastore.
func getLatestEventData(c context.Context, etags []string) (*eventData, error) {
	q := datastore.NewQuery(kindEventData).
		Ancestor(eventDataParent(c)).
		Order("-ts").
		Limit(1)

	var res []*struct {
		Timestamp time.Time `datastore:"ts"`
		Bytes     []byte    `datastore:"data"`
	}
	keys, err := q.GetAll(c, &res)
	if err != nil {
		return nil, err
	}

	data := &eventData{}
	if len(res) == 0 {
		return data, nil
	}
	data.etag = fmt.Sprintf("%x", md5.Sum([]byte(keys[0].String())))
	data.modified = res[0].Timestamp
	for _, t := range etags {
		if data.etag == strings.Trim(t, `"`) {
			return data, errNotModified
		}
	}
	return data, gob.NewDecoder(bytes.NewReader(res[0].Bytes)).Decode(data)
}

// storeChanges saves d in the datastore with auto-generated ID
// and a common ancestor provided by changesParent().
// All fields are unindexed except for d.Changed.
// Even though d.Token is stored, its value must not be used when
// retrieved from the datastore later on.
func storeChanges(c context.Context, d *dataChanges) error {
	b, err := json.Marshal(d)
	if err != nil {
		return err
	}
	// TODO: handle a case where len(b) > 1Mb
	ent := &struct {
		Timestamp time.Time `datastore:"ts"`
		Bytes     []byte    `datastore:"data"`
	}{d.Updated, b}
	key := datastore.NewIncompleteKey(c, kindChanges, changesParent(c))
	_, err = datastore.Put(c, key, ent)
	return err
}

// getChangesSince queries datastore for all changes occurred since time t
// and returns them all combined in one dataChanges result.
// In a case where multiple changes have been introduced in the same data items,
// older changes will be overwritten by the most recent ones.
// At most 1000 changes will be returned.
// Resulting dataChanges.Changed time will be set to the most recent one.
func getChangesSince(c context.Context, t time.Time) (*dataChanges, error) {
	q := datastore.NewQuery(kindChanges).
		Ancestor(changesParent(c)).
		Filter("ts > ", t).
		Order("ts").
		Limit(1000)

	var res []*struct {
		Timestamp time.Time `datastore:"ts"`
		Bytes     []byte    `datastore:"data"`
	}
	if _, err := q.GetAll(c, &res); err != nil {
		return nil, err
	}

	changes := &dataChanges{
		Updated: t,
		eventData: eventData{
			Sessions: make(map[string]*eventSession),
			Speakers: make(map[string]*eventSpeaker),
			Videos:   make(map[string]*eventVideo),
		},
	}
	if len(res) == 0 {
		return changes, nil
	}

	for _, item := range res {
		dc := &dataChanges{}
		if err := json.Unmarshal(item.Bytes, dc); err != nil {
			errorf(c, "getChangesSince: %v at ts = %s", err, item.Timestamp)
			continue
		}
		mergeChanges(changes, dc)
	}
	return changes, nil
}

// eventDataParent returns a common ancestor for all kindEventData entities.
func eventDataParent(c context.Context) *datastore.Key {
	return datastore.NewKey(c, kindEventData, "root", 0, nil)
}

// changesParent returns a common ancestor for all kindChanges entities.
func changesParent(c context.Context) *datastore.Key {
	return datastore.NewKey(c, kindChanges, "root", 0, nil)
}
