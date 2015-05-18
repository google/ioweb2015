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

// +build !appengine

// TODO: implement using Bolt: https://github.com/boltdb/bolt

package main

import (
	"errors"
	"time"

	"golang.org/x/net/context"
)

// RunInTransaction runs f in a transaction.
// It calls f with a transaction context tc that f should use for all operations.
func runInTransaction(c context.Context, f func(tc context.Context) error) error {
	// TODO: implement transaction support
	return f(c)
}

// storeCredentials saves OAuth2 credentials cred in a presistent DB.
// cred must have userID set to a non-zero value.
func storeCredentials(c context.Context, cred *oauth2Credentials) error {
	// TODO: implement
	return nil
}

// updateCredentials patches existing Cred entity with the provided new ncred credentials
// in a transaction.
func updateCredentials(c context.Context, ncred *oauth2Credentials) error {
	return errors.New("not implemented")
}

// getCredentials fetches user credentials from a persistent DB.
func getCredentials(c context.Context, uid string) (*oauth2Credentials, error) {
	// TODO: implement
	return nil, errors.New("not implemented")
}

// storeUserPushInfo saves user push configuration in a persistent DB.
// info must have userID set to a non-zero value.
func storeUserPushInfo(c context.Context, p *userPush) error {
	// TODO: implement
	return nil
}

// updatePushEndpoint replaces old endpoint with the new URL nurl.
// It must be run in a transactional context.
func updatePushEndpoint(c context.Context, uid, endpoint, nurl string) error {
	return errors.New("not implemented")
}

// deletePushEndpoint removes endpoint from the list of push endpoints of user uid.
// It must be run in a transactional context.
func deletePushEndpoint(c context.Context, uid, endpoint string) error {
	return errors.New("not implemented")
}

// getUserPushInfo fetches user push configuration from a persistent DB.
// If the configuration does not exist yet, a default one is returned.
// Default configuration has all notification settings disabled.
func getUserPushInfo(c context.Context, uid string) (*userPush, error) {
	// TODO: implement
	return nil, errors.New("not implemented")
}

// listUsersWithPush returns user IDs which have userPush.Enabled == true.
func listUsersWithPush(c context.Context) ([]string, error) {
	return nil, errors.New("not implemented")
}

// storeLocalAppFolderMeta saves data.FileID and data.Etag in a local db under key of user uid.
func storeLocalAppFolderMeta(c context.Context, uid string, data *appFolderData) error {
	return errors.New("not implemented")
}

// getLocalAppFolderMeta returns appFolderData of user uid with only FileID and Etag set.
func getLocalAppFolderMeta(c context.Context, uid string) (*appFolderData, error) {
	return nil, errors.New("not implemented")
}

func storeEventData(c context.Context, d *eventData) error {
	return errors.New("not implemented")
}

// clearEventData deletes all EventData entities.
func clearEventData(c context.Context) error {
	return errors.New("not implemented")
}

func getLatestEventData(c context.Context, etags []string) (*eventData, error) {
	return nil, errors.New("not implemented")
}

func getSessionByID(c context.Context, id string) (*eventSession, error) {
	return nil, errors.New("not implemented")
}

func storeChanges(c context.Context, d *dataChanges) error {
	return errors.New("not implemented")
}

// getChangesSince queries DB for all changes occurred since time t
// and returns them all combined in one dataChanges result.
// In a case where multiple changes have been introduced in the same data items,
// older changes will be overwritten by the most recent ones.
// At most 1000 changes will be returned.
// Resulting dataChanges.Changed time will be set to the most recent one.
func getChangesSince(c context.Context, t time.Time) (*dataChanges, error) {
	return nil, errors.New("not implemented")
}

// storeNextSessions saves IDs of items under kindNext entity kind,
// keyed by "sessionID:eventSession.Update".
func storeNextSessions(c context.Context, items []*eventSession) error {
	return errors.New("not implemented")
}

// filterNextSessions queries kindNext entities and returns a subset of items
// containing only the elements not present in the datastore, previously saved with
// storeNextSessions().
func filterNextSessions(c context.Context, items []*eventSession) ([]*eventSession, error) {
	return nil, errors.New("not implemented")
}

// storeEasterEgg replaces current easter egg data with egg.
func storeEasterEgg(c context.Context, egg *easterEgg) error {
	return errors.New("not implemented")
}

// getEasterEggLink returns current easter egg link or empty string
// if not found or expired.
func getEasterEggLink(c context.Context) string {
	return ""
}

func updateEggCache(c context.Context, egg *easterEgg) error {
	return errors.New("not implemented")
}

func getCachedEgg(c context.Context) (*easterEgg, error) {
	return nil, errors.New("not implemented")
}
