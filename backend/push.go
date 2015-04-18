package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"strconv"
	"time"

	"golang.org/x/net/context"
)

//  userPush is user notification configuration.
type userPush struct {
	userID string

	Enabled     bool     `json:"notify" datastore:"on"`
	Subscribers []string `json:"subscribers,omitempty" datastore:"subs,noindex"`
	Endpoints   []string `json:"-" datastore:"urls,noindex"`

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
	Changed time.Time `json:"ts"`
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

	dst.Changed = src.Changed
}

// filterUserChanges reduces dc to a subset matching session IDs to bks.
// TODO: add ioext to dc and filter on radius for ioExtPush.Lat+Lng.
func filterUserChanges(dc *dataChanges, bks []string, ext *ioExtPush) {
	for _, id := range bks {
		delete(dc.Sessions, id)
	}
}

// pingUser sends a "ping" push message to all user devices
func pingUser(c context.Context, uid string) error {
	pi, err := getUserPushInfo(c, uid)
	if err != nil {
		return fmt.Errorf("pingUser: %v", err)
	}
	if !pi.Enabled {
		return nil
	}

	params := struct {
		RIDs []string `json:"registration_ids"`
	}{
		RIDs: make([]string, 0, len(pi.Subscribers)),
	}
	for i, id := range pi.Subscribers {
		if pi.Endpoints[i] != config.Google.GCM.Endpoint {
			logf(c, "pingUser: unknown endpoint %q; reg = %s", pi.Endpoints[i], id)
			continue
		}
		params.RIDs = append(params.RIDs, id)
	}
	b, err := json.Marshal(&params)
	if err != nil {
		return fmt.Errorf("pingUser: %v", err)
	}
	logf(c, "DEBUG: posting to %q:\n%s", config.Google.GCM.Endpoint, b)
	r, err := http.NewRequest("POST", config.Google.GCM.Endpoint, bytes.NewReader(b))
	if err != nil {
		return fmt.Errorf("pingUser: %v", err)
	}
	r.Header.Set("content-type", "application/json")
	r.Header.Set("authorization", "key="+config.Google.GCM.Key)

	res, err := httpClient(c).Do(r)
	if err != nil {
		return fmt.Errorf("pingUser: %v", err)
	}
	defer res.Body.Close()
	if b, err = ioutil.ReadAll(res.Body); err != nil {
		return fmt.Errorf("pingUser: %v", err)
	}
	logf(c, "pingUser: response:\n%s", b)
	// TODO: handle GCM errors in b
	return nil
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
