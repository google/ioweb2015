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

// +build appengine

package main

import (
	"bytes"
	"crypto/md5"
	"encoding/gob"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"strings"
	"time"

	"golang.org/x/net/context"
	"google.golang.org/appengine"
	"google.golang.org/appengine/datastore"
)

const (
	kindCredentials = "Cred"
	kindUserPush    = "Push"
	kindEventData   = "EventData"
	kindChanges     = "Changes"
	kindAppFolder   = "AppFolder"
	kindNext        = "Next"
	kindEgg         = "Egg"
)

type eventDataCache struct {
	Etag      string    `datastore:"-"`
	Timestamp time.Time `datastore:"ts"`
	Bytes     []byte    `datastore:"data"`
}

var (
	cachedEventDataKey     string
	allCachedEventDataKeys []string
)

func init() {
	rand.Seed(time.Now().UnixNano())
	// shard the memcache key across 4 instances
	cachedEventDataKey = fmt.Sprintf("%s-%d", kindEventData, rand.Intn(4))
	allCachedEventDataKeys = []string{
		kindEventData + "-0",
		kindEventData + "-1",
		kindEventData + "-2",
		kindEventData + "-3",
	}
}

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

// updateCredentials patches existing Cred entity with the provided new ncred credentials
// in a transaction.
func updateCredentials(c context.Context, ncred *oauth2Credentials) error {
	return runInTransaction(c, func(c context.Context) error {
		cred, err := getCredentials(c, ncred.userID)
		if err != nil {
			return fmt.Errorf("updateCredentials: %v", err)
		}
		cred.AccessToken = ncred.AccessToken
		cred.Expiry = ncred.Expiry
		cred.RefreshToken = ncred.RefreshToken
		err = storeCredentials(c, cred)
		if err != nil {
			err = fmt.Errorf("updateCredentials: %v", err)
		}
		return err
	})
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

// updatePushEndpoint replaces old endpoint with the new URL nurl.
// It must be run in a transactional context.
func updatePushEndpoint(c context.Context, uid, endpoint, nurl string) error {
	pi, err := getUserPushInfo(c, uid)
	if err != nil {
		return err
	}
	for i, e := range pi.Endpoints {
		if e == endpoint {
			pi.Endpoints[i] = nurl
			return storeUserPushInfo(c, pi)
		}
	}
	return nil
}

// deletePushEndpoint removes endpoint from the list of push endpoints of user uid.
// It must be run in a transactional context.
func deletePushEndpoint(c context.Context, uid, endpoint string) error {
	pi, err := getUserPushInfo(c, uid)
	if err != nil {
		return err
	}
	for i, e := range pi.Endpoints {
		if e == endpoint {
			pi.Endpoints = append(pi.Endpoints[:i], pi.Endpoints[i+1:]...)
			if i < len(pi.Subscribers) {
				pi.Subscribers = append(pi.Subscribers[:i], pi.Subscribers[i+1:]...)
			}
			return storeUserPushInfo(c, pi)
		}
	}
	return nil
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
	c, _ = context.WithTimeout(c, time.Minute)
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

// storeLocalAppFolderMeta saves data.FileID and data.Etag in a local db under key of user uid.
func storeLocalAppFolderMeta(c context.Context, uid string, data *appFolderData) error {
	key := datastore.NewKey(c, kindAppFolder, uid, 0, nil)
	_, err := datastore.Put(c, key, data)
	return err
}

// getLocalAppFolderMeta returns appFolderData of user uid with only FileID and Etag set.
func getLocalAppFolderMeta(c context.Context, uid string) (*appFolderData, error) {
	key := datastore.NewKey(c, kindAppFolder, uid, 0, nil)
	data := &appFolderData{}
	return data, datastore.Get(c, key, data)
}

// storeEventData saves d in the datastore with auto-generated ID
// and a common ancestor provided by eventDataParent().
// All fields are unindexed except for d.modified.
// Unexported fields other than d.modified are not stored.
func storeEventData(c context.Context, d *eventData) error {
	perr := prefixedErr("storeEventData")
	var b bytes.Buffer
	if err := gob.NewEncoder(&b).Encode(d); err != nil {
		return perr(err)
	}
	// TODO: handle a case where b.Bytes() is > 1Mb
	ent := &eventDataCache{
		Timestamp: d.modified,
		Bytes:     b.Bytes(),
	}
	key := datastore.NewIncompleteKey(c, kindEventData, eventDataParent(c))
	key, err := datastore.Put(c, key, ent)
	if err != nil {
		return perr(err)
	}
	ent.Etag = hexKey(key)
	cache.deleleMulti(c, allCachedEventDataKeys)
	return nil
}

// clearEventData deletes all EventData entities and flushes cache.
func clearEventData(c context.Context) error {
	if err := cache.flush(c); err != nil {
		return err
	}
	q := datastore.NewQuery(kindEventData).
		Ancestor(eventDataParent(c)).
		KeysOnly()
	keys, err := q.GetAll(c, nil)
	if err != nil {
		return fmt.Errorf("clearEventData: %v", err)
	}
	return datastore.DeleteMulti(c, keys)
}

func getCachedEventData(c context.Context) (*eventDataCache, error) {
	b, err := cache.get(c, cachedEventDataKey)
	if err != nil {
		return nil, err
	}
	d := &eventDataCache{}
	return d, gob.NewDecoder(bytes.NewReader(b)).Decode(d)
}

func cacheEventData(c context.Context, d *eventDataCache) error {
	var b bytes.Buffer
	if err := gob.NewEncoder(&b).Encode(d); err != nil {
		return err
	}
	return cache.set(c, cachedEventDataKey, b.Bytes(), 1*time.Hour)
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
	res, err := getCachedEventData(c)
	if err != nil {
		q := datastore.NewQuery(kindEventData).
			Ancestor(eventDataParent(c)).
			Order("-ts").
			Limit(1)
		var dbres []*eventDataCache
		keys, err := q.GetAll(c, &dbres)
		if err != nil {
			return nil, err
		}
		if len(keys) == 0 {
			return &eventData{}, nil
		}
		res = dbres[0]
		res.Etag = hexKey(keys[0])
		if err := cacheEventData(c, res); err != nil {
			errorf(c, "getLatestEventData: %v", err)
		}
	}

	data := &eventData{
		etag:     res.Etag,
		modified: res.Timestamp,
	}
	for _, t := range etags {
		if data.etag == strings.Trim(t, `"`) {
			return data, errNotModified
		}
	}
	return data, gob.NewDecoder(bytes.NewReader(res.Bytes)).Decode(data)
}

// getSessionByID returns the session from getLatestEventData() if it exists,
// otherwise an error.
func getSessionByID(c context.Context, id string) (*eventSession, error) {
	d, err := getLatestEventData(c, nil)
	if err != nil {
		return nil, err
	}
	s, ok := d.Sessions[id]
	if !ok {
		err = datastore.ErrNoSuchEntity
	}
	return s, err
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

// storeNextSessions saves IDs of items under kindNext entity kind,
// keyed by "sessionID:eventSession.Update".
func storeNextSessions(c context.Context, items []*eventSession) error {
	pkey := nextSessionParent(c)
	keys := make([]*datastore.Key, len(items))
	for i, s := range items {
		id := s.Id + ":" + s.Update
		keys[i] = datastore.NewKey(c, kindNext, id, 0, pkey)
	}
	zeros := make([]struct{}, len(keys))
	_, err := datastore.PutMulti(c, keys, zeros)
	return err
}

// filterNextSessions queries kindNext entities and returns a subset of items
// containing only the elements not present in the datastore, previously saved with
// storeNextSessions().
func filterNextSessions(c context.Context, items []*eventSession) ([]*eventSession, error) {
	pkey := nextSessionParent(c)
	keys := make([]*datastore.Key, len(items))
	for i, s := range items {
		id := s.Id + ":" + s.Update
		keys[i] = datastore.NewKey(c, kindNext, id, 0, pkey)
	}
	zeros := make([]struct{}, len(keys))
	err := datastore.GetMulti(c, keys, zeros)
	merr, ok := err.(appengine.MultiError)
	if !ok && err != nil {
		return nil, err
	}
	res := make([]*eventSession, 0, len(keys))
	for i, e := range merr {
		if e == nil {
			continue
		}
		if e != datastore.ErrNoSuchEntity {
			return nil, err
		}
		res = append(res, items[i])
	}
	return res, nil
}

// storeEasterEgg replaces current easter egg data with egg.
func storeEasterEgg(c context.Context, egg *easterEgg) error {
	k := datastore.NewKey(c, kindEgg, "latest", 0, nil)
	if _, err := datastore.Put(c, k, egg); err != nil {
		return err
	}
	if err := updateEggCache(c, egg); err != nil {
		errorf(c, "storeEasterEgg: %v", err)
	}
	return nil
}

// getEasterEggLink returns current easter egg link or empty string
// if not found or expired.
func getEasterEggLink(c context.Context) string {
	egg, err := getCachedEgg(c)
	if err != nil {
		egg = &easterEgg{}
		k := datastore.NewKey(c, kindEgg, "latest", 0, nil)
		if err := datastore.Get(c, k, egg); err != nil {
			return ""
		}
		updateEggCache(c, egg)
	}
	link := egg.Link
	if egg.expired() {
		link = ""
	}
	return link
}

func updateEggCache(c context.Context, egg *easterEgg) error {
	b, err := json.Marshal(egg)
	if err != nil {
		return err
	}
	return cache.set(c, kindEgg, b, time.Hour)
}

func getCachedEgg(c context.Context) (*easterEgg, error) {
	b, err := cache.get(c, kindEgg)
	if err != nil {
		return nil, err
	}
	egg := &easterEgg{}
	return egg, json.Unmarshal(b, egg)
}

// eventDataParent returns a common ancestor for all kindEventData entities.
func eventDataParent(c context.Context) *datastore.Key {
	return datastore.NewKey(c, kindEventData, "root", 0, nil)
}

// changesParent returns a common ancestor for all kindChanges entities.
func changesParent(c context.Context) *datastore.Key {
	return datastore.NewKey(c, kindChanges, "root", 0, nil)
}

// nextSessionParent returns a common ancestor for all kindNext session entities.
func nextSessionParent(c context.Context) *datastore.Key {
	return datastore.NewKey(c, kindNext, "session", 0, nil)
}

// hexKey returns a representation of a key k in base 16.
// Useful for etags.
func hexKey(k *datastore.Key) string {
	return fmt.Sprintf("%x", md5.Sum([]byte(k.String())))
}
