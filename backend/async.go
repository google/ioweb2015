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

package main

import (
	"errors"
	"time"

	"golang.org/x/net/context"
)

// notifySubscriberAsync creates an async job to begin notify subscribers.
func notifySubscribersAsync(c context.Context, d *dataChanges, all bool) error {
	return errors.New("not implemented")
}

// pingUserAsync creates an async job to send a push notification to user uid.
// skeys are session IDs used to compare against user bookmarks.
// TODO: add ioext support
func pingUserAsync(c context.Context, uid string, skeys []string, all bool) error {
	return errors.New("not implemented")
}

// pingDevicesAsync schedules len(endpoints) tasks of /ping-device.
// d specifies the duration the tasker must wait before executing the task.
// If scheduling fails for some endpoints, those will be in the returned values
// along with a non-nil error.
func pingDevicesAsync(c context.Context, uid string, endpoints []string, d time.Duration) ([]string, error) {
	return nil, errors.New("not implemented")
}

// pingExtPartyAsync notifies extra parties at config.ExtPingURL about data updates.
func pingExtPartyAsync(c context.Context, key string) error {
	return errors.New("not implemented")
}

// submitSessionSurveyAsync schedules an async job to submit feedback survey s for session sid.
func submitSessionSurveyAsync(c context.Context, sid string, s *sessionSurvey) error {
	return errors.New("not implemented")
}
