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
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	"golang.org/x/net/context"
	"google.golang.org/appengine"
	"google.golang.org/appengine/taskqueue"
)

// notifySubscriberAsync creates an async job to begin notify subscribers.
func notifySubscribersAsync(c context.Context, d *dataChanges, all bool) error {
	skeys := make([]string, 0, len(d.Sessions))
	for id, _ := range d.Sessions {
		skeys = append(skeys, id)
	}
	p := path.Join(config.Prefix, "/task/notify-subscribers")
	// TODO: add ioext to the payload
	t := taskqueue.NewPOSTTask(p, url.Values{
		"sessions": {strings.Join(skeys, " ")},
		"all":      {fmt.Sprintf("%v", all)},
	})
	_, err := taskqueue.Add(c, t, "")
	return err
}

// pingUserAsync creates an async job to send a push notification to user devices.
// sessions are session IDs used to compare against user bookmarks.
// TODO: add ioext support
func pingUserAsync(c context.Context, uid string, sessions []string, all bool) error {
	p := path.Join(config.Prefix, "/task/ping-user")
	t := taskqueue.NewPOSTTask(p, url.Values{
		"uid":      {uid},
		"sessions": {strings.Join(sessions, " ")},
		"all":      {fmt.Sprintf("%v", all)},
	})
	_, err := taskqueue.Add(c, t, "")
	return err
}

// pingDevicesAsync schedules len(endpoints) tasks of /ping-device.
// d specifies the duration the tasker must wait before executing the task.
// If scheduling fails for some endpoints, those will be in the returned values
// along with a non-nil error.
func pingDevicesAsync(c context.Context, uid string, endpoints []string, d time.Duration) ([]string, error) {
	if len(endpoints) == 0 {
		return nil, nil
	}
	p := path.Join(config.Prefix, "/task/ping-device")
	jobs := make([]*taskqueue.Task, 0, len(endpoints))
	for _, endpoint := range endpoints {
		t := taskqueue.NewPOSTTask(p, url.Values{
			"uid":      {uid},
			"endpoint": {endpoint},
		})
		t.Delay = d
		jobs = append(jobs, t)
	}

	_, err := taskqueue.AddMulti(c, jobs, "")
	merr, mok := err.(appengine.MultiError)
	if !mok {
		return nil, err
	}

	errEndpoints := make([]string, 0)
	for i, e := range merr {
		if e == nil {
			continue
		}
		errEndpoints = append(errEndpoints, endpoints[i])
	}
	if len(errEndpoints) == 0 {
		return nil, nil
	}
	return errEndpoints, fmt.Errorf("pingDevicesAsync: %v", err)
}

// pingExtPartyAsync notifies extra parties at config.ExtPingURL about data updates.
func pingExtPartyAsync(c context.Context, key string) error {
	if key == "" || config.ExtPingURL == "" {
		return nil
	}
	p := path.Join(config.Prefix, "/task/ping-ext")
	t := taskqueue.NewPOSTTask(p, url.Values{
		"key": {key},
	})
	_, err := taskqueue.Add(c, t, "")
	return err
}

// submitSessionSurveyAsync schedules an async job to submit feedback survey s for session sid.
func submitSessionSurveyAsync(c context.Context, sid string, s *sessionSurvey) error {
	payload, err := json.Marshal(s)
	if err != nil {
		return err
	}
	h := make(http.Header)
	h.Set("Content-Type", "application/json")
	t := &taskqueue.Task{
		Path:    path.Join(config.Prefix, "/task/survey", sid),
		Payload: payload,
		Header:  h,
		Method:  "POST",
	}
	_, err = taskqueue.Add(c, t, "")
	return err
}
