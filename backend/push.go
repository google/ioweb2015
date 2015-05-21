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
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"golang.org/x/net/context"
)

const (
	// eventSession.Update field
	updateDetails = "details"
	updateVideo   = "video"
	updateStart   = "start"
	updateSoon    = "soon"
	updateSurvey  = "survey"
)

//  userPush is user notification configuration.
type userPush struct {
	userID string

	Enabled   bool     `json:"notify" datastore:"on"`
	IOStart   bool     `json:"iostart" datastore:"io"`
	Endpoints []string `json:"endpoints" datastore:"urls,noindex"`
	// TODO: remove this when all existing users are migrated to Endpoints.
	// Until that is done:
	// - len(Subscribers) may be less than len(Endpoints)
	// - first elements of Endpoints will match Subscribers
	Subscribers []string `json:"-" datastore:"subs,noindex"`

	Ext  ioExtPush  `json:"-" datastore:"ext"`
	Pext *ioExtPush `json:"ioext,omitempty" datastore:"-"`
}

// ioExtPush is always embedded in the userPush.
type ioExtPush struct {
	Enabled bool    `json:"-" datastore:"on"`
	Name    string  `json:"name" datastore:"n,noindex"`
	Lat     float64 `json:"lat" datastore:"lat,noindex"`
	Lng     float64 `json:"lng" datastore:"lng,noindex"`
}

// dataChanges represents a diff between two versions of data.
// See diff funcs for more details, e.g. diffEventData().
// TODO: add GobEncoder/Decoder to use gob instead of json when storing in DB.
type dataChanges struct {
	Token   string    `json:"token"`
	Updated time.Time `json:"ts"`
	eventData
	// TODO: add ioext data...  anything else?
}

// isEmptyChange returns true if d is nil or its exported fields contain no items.
// d.Token and d.Changed are not considered.
func isEmptyChanges(d *dataChanges) bool {
	return d == nil || (len(d.Sessions) == 0 && len(d.Speakers) == 0 && len(d.Videos) == 0 && len(d.Tags) == 0)
}

// mergeChanges copies changes from src to dst.
// It doesn't do deep copy.
func mergeChanges(dst *dataChanges, src *dataChanges) {
	// TODO: find a more elegant way of doing this
	sessions := dst.Sessions
	if sessions == nil {
		sessions = make(map[string]*eventSession)
	}
	for id, s := range src.Sessions {
		sessions[id] = s
	}
	dst.Sessions = sessions

	speakers := dst.Speakers
	if speakers == nil {
		speakers = make(map[string]*eventSpeaker)
	}
	for id, s := range src.Speakers {
		speakers[id] = s
	}
	dst.Speakers = speakers

	videos := dst.Videos
	if videos == nil {
		videos = make(map[string]*eventVideo)
	}
	for id, s := range src.Videos {
		videos[id] = s
	}
	dst.Videos = videos

	dst.Updated = src.Updated
}

// filterUserChanges reduces dc to a subset matching session IDs to bks.
// It sorts bks with sort.Strings as a side effect.
// TODO: add ioext to dc and filter on radius for ioExtPush.Lat+Lng.
func filterUserChanges(dc *dataChanges, bks []string, ext *ioExtPush) {
	sort.Strings(bks)
	for id, s := range dc.Sessions {
		if s.Update == updateSurvey {
			// surveys don't have to match bookmarks
			continue
		}
		i := sort.SearchStrings(bks, id)
		if i >= len(bks) || bks[i] != id {
			delete(dc.Sessions, id)
		}
	}
}

// pingDevice sends a "ping" message to the subscribed device.
// It follows HTTP Push spec https://tools.ietf.org/html/draft-thomson-webpush-http2.
//
// In a case where endpoint did not accept push request the return error
// will be of type *pushError with RetryAfter >= 0.
// If returned string value is non-zero, it contains a new endpoint
// to be used instead of the old one from now on.
func pingDevice(c context.Context, endpoint string) (string, error) {
	if u := config.Google.GCM.Endpoint; u != "" && strings.HasPrefix(endpoint, u) {
		return pingGCM(c, endpoint)
	}

	logf(c, "pinging generic endpoint: %s", endpoint)
	req, err := http.NewRequest("PUT", endpoint, nil)
	if err != nil {
		// invalid endpoint URL
		return "", &pushError{msg: fmt.Sprintf("pingDevice: %v", err), remove: true}
	}

	res, err := httpClient(c).Do(req)
	if err != nil {
		return "", &pushError{msg: fmt.Sprintf("pingDevice: %v", err), retry: true}
	}
	defer res.Body.Close()
	if res.StatusCode == http.StatusOK {
		return "", nil
	}
	b, _ := ioutil.ReadAll(res.Body)
	perr := &pushError{
		msg:    fmt.Sprintf("%s %s", res.Status, b),
		remove: res.StatusCode >= 400 && res.StatusCode < 500,
	}
	if !perr.remove {
		perr.retry = true
		perr.after = 10 * time.Second
	}
	return "", perr
}

// pingGCM is a special case of pingDevice for GCM endpoints.
func pingGCM(c context.Context, endpoint string) (string, error) {
	reg, endpoint := extractGCMRegistration(endpoint)
	data := url.Values{"registration_id": {reg}}
	r, err := http.NewRequest("POST", endpoint, strings.NewReader(data.Encode()))
	if err != nil {
		// invalid endpoint URL
		return "", &pushError{msg: fmt.Sprintf("pingGCM: %v", err), remove: true}
	}
	r.Header.Set("content-type", "application/x-www-form-urlencoded")
	r.Header.Set("authorization", "key="+config.Google.GCM.Key)

	logf(c, "DEBUG: posting to %q: %v", endpoint, data)
	resp, err := httpClient(c).Do(r)
	if err != nil {
		return "", &pushError{msg: fmt.Sprintf("pingGCM: %v", err), retry: true}
	}
	defer resp.Body.Close()
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return "", &pushError{msg: fmt.Sprintf("pingGCM: %v", err), retry: true}
	}
	logf(c, "pingGCM: response: %s %s", resp.Status, body)

	q, err := url.ParseQuery(string(body))
	if err != nil {
		errorf(c, "%v: %s", err, body)
		q = url.Values{}
	}
	errorStr := q.Get("Error")
	retry, _ := strconv.Atoi(resp.Header.Get("retry-after"))
	after := time.Duration(retry) * time.Second
	if after < time.Second {
		after = 10 * time.Second
	}
	if resp.StatusCode != http.StatusOK {
		return "", &pushError{
			msg:    fmt.Sprintf("pingGCM: %s %s", resp.Status, body),
			remove: resp.StatusCode == http.StatusNotFound,
			retry:  resp.StatusCode >= 500,
			after:  after,
		}
	}
	if errorStr == "" {
		return pushEndpointURL(q.Get("registration_id"), ""), nil
	}
	pe := &pushError{
		msg:   "pingDevice: " + errorStr,
		after: after,
	}
	switch errorStr {
	case "NotRegistered", "MissingRegistration", "InvalidRegistration":
		pe.remove = true
	case "Unavailable", "InternalServerError", "DeviceMessageRateExceeded":
		pe.retry = true
	}
	return "", pe
}

// extractGCMRegistration splits endpoint into registration ID and GCM endpoint URL.
func extractGCMRegistration(endpoint string) (string, string) {
	reg := strings.TrimPrefix(endpoint, config.Google.GCM.Endpoint)
	return strings.TrimLeft(reg, "/"), config.Google.GCM.Endpoint
}

// pushEndpointURL does the opposite of extractGCMRegistration.
// endpoint defaults to config.Google.GCM.Endpoint.
func pushEndpointURL(reg string, endpoint string) string {
	if reg == "" && endpoint == "" {
		return ""
	}
	if reg == "" {
		return endpoint
	}
	if endpoint == "" {
		endpoint = config.Google.GCM.Endpoint
	}
	endpoint = strings.TrimRight(endpoint, "/")
	reg = strings.TrimLeft(reg, "/")
	return endpoint + "/" + reg
}

// upgradeSubscribers replaces registration IDs regs with GCM-based endpoint URLs
// using pushEndpointURL() func.
// Returned value is converted regs and non-GCM endpoints.
// Original args remain unchanged.
func upgradeSubscribers(regs []string, endpoints []string) []string {
	endpoints = append([]string{}, endpoints...)
	for _, id := range regs {
		endpoints = append(endpoints, pushEndpointURL(id, ""))
	}
	return unique(subslice(endpoints, config.Google.GCM.Endpoint))
}

// swTokenSep is SW token separator used in encode/decodeSWToken.
var swTokenSep = []byte(" ")

// encodeSWToken returns user ID and timestamp encoded base64 with an HMAC
// The token format, when base64-decoded is: "uid unix hmac".
func encodeSWToken(uid string, t time.Time) (string, error) {
	if config.Secret == "" {
		return "", errors.New("encodeSWToken: secret is not set")
	}
	// TODO: maybe do AES encryption, unless GCM will allow payloads soon
	// and the whole SWtoken thing becomes redundant.
	msg := []byte(fmt.Sprintf("%s%s%d", uid, swTokenSep, t.Unix()))
	mac := hmac.New(sha256.New, []byte(config.Secret))
	mac.Write(msg)
	tok := append(msg, swTokenSep...)
	tok = append(tok, mac.Sum(nil)...)
	return base64.StdEncoding.EncodeToString(tok), nil
}

// decodeSWToken decodes t and returns its parts, user ID and timestamp.
func decodeSWToken(t string) (string, time.Time, error) {
	var zero time.Time // TODO: find a more elegant way
	if config.Secret == "" {
		return "", zero, errors.New("decodeSWToken: secret is not set")
	}
	tok, err := base64.StdEncoding.DecodeString(t)
	if err != nil {
		return "", zero, fmt.Errorf("decodeSWToken: %v", err)
	}
	// "uid unix hmac"
	parts := bytes.SplitN(tok, swTokenSep, 3)
	if len(parts) != 3 {
		return "", zero, errors.New("decodeSWToken: invalid token format")
	}
	msg := append(parts[0], swTokenSep...)
	msg = append(msg, parts[1]...)
	mac := hmac.New(sha256.New, []byte(config.Secret))
	mac.Write(msg)
	if !hmac.Equal(parts[2], mac.Sum(nil)) {
		return "", zero, errors.New("decodeSWToken: hmac doesn't match")
	}
	usec, err := strconv.ParseInt((string(parts[1])), 10, 0)
	if err != nil {
		return "", zero, errors.New("decodeSWToken: invalid unix timestamp")
	}
	return string(parts[0]), time.Unix(usec, 0), nil
}
