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
	"testing"
	"time"
)

func TestStoreGetCredentials(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)

	cred1 := &oauth2Credentials{
		userID:       "user-123",
		AccessToken:  "atoken",
		RefreshToken: "rtoken",
		Expiry:       time.Now(),
	}

	r := newTestRequest(t, "GET", "/", nil)
	c := newContext(r)
	if err := storeCredentials(c, cred1); err != nil {
		t.Fatalf("storeCredentials: %v", err)
	}

	cred2, err := getCredentials(c, cred1.userID)
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

	v, err := getCredentials(c, "random-user")
	if err == nil {
		t.Errorf("getCredentials: %+v; want error", v)
	}
}

func TestStoreGetChanges(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)

	c := newContext(newTestRequest(t, "GET", "/dummy", nil))
	oneTime := time.Now()
	twoTime := oneTime.AddDate(0, 0, 1)

	if err := storeChanges(c, &dataChanges{
		Updated: oneTime,
		eventData: eventData{
			Sessions: map[string]*eventSession{"one": &eventSession{}},
		},
	}); err != nil {
		t.Fatal(err)
	}
	if err := storeChanges(c, &dataChanges{
		Updated: twoTime,
		eventData: eventData{
			Sessions: map[string]*eventSession{
				"two":   &eventSession{},
				"three": &eventSession{},
			},
		},
	}); err != nil {
		t.Fatal(err)
	}

	table := []struct {
		arg time.Time
		ids []string
	}{
		{oneTime.Add(-1 * time.Second), []string{"one", "two", "three"}},
		{oneTime, []string{"two", "three"}},
		{twoTime, []string{}},
	}

	for i, test := range table {
		dc, err := getChangesSince(c, test.arg)
		if err != nil {
			t.Errorf("%d: %v", i, err)
		}
		if len(dc.Sessions) != len(test.ids) {
			t.Errorf("%d: len(dc.Sessions) = %d; want %d", i, len(dc.Sessions), len(test.ids))
		}
		for _, id := range test.ids {
			if _, ok := dc.Sessions[id]; !ok {
				t.Errorf("%d: want session %q", i, id)
			}
		}
	}
}

func TestStoreNextSessions(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)

	c := newContext(newTestRequest(t, "GET", "/dummy", nil))
	sessions := []*eventSession{
		&eventSession{Id: "one", Update: updateSoon},
		&eventSession{Id: "one", Update: updateStart},
		&eventSession{Id: "two", Update: updateStart},
	}
	if err := storeNextSessions(c, sessions); err != nil {
		t.Fatal(err)
	}
	sessions = append(sessions, &eventSession{Id: "new", Update: updateStart})
	items, err := filterNextSessions(c, sessions)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].Id != "new" {
		t.Errorf("items = %v; want 'new'", items)
	}
}
