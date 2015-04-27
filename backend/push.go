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
	updateDetails = "details"
	updateVideo   = "video"
	updateStart   = "start"
)

// pushError is used in methods that communicate with Push services like GCM.
//  - msg: error message
//  - retry: whether the caller should retry
//  - after: try again after this duration, unless retry == false
//  - remove: the caller should remove the subscription ID. Implies retry == false.
type pushError struct {
	msg    string
	retry  bool
	remove bool
	after  time.Duration
}

func (pe *pushError) Error() string {
	return pe.msg
}

func (pe *pushError) String() string {
	return fmt.Sprintf("<pushError: retry=%v; remove=%v; after=%v; %s>",
		pe.retry, pe.remove, pe.after, pe.msg)
}

//  userPush is user notification configuration.
type userPush struct {
	userID string

	Enabled     bool     `json:"notify" datastore:"on"`
	IOStart     bool     `json:"iostart" datastore:"io"`
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
	for id := range dc.Sessions {
		i := sort.SearchStrings(bks, id)
		if i >= len(bks) || bks[i] != id {
			delete(dc.Sessions, id)
		}
	}
}

// pingDevice sends a "ping" message to device subscribed to endpoint.
// In a case where GCM did not accept push request the return error
// will be of type *pushError with RetryAfter >= 0.
// If returned string value is not zero, it contains a canonical reg ID.
// TODO: Chrome 44 deprecates reg.
func pingDevice(c context.Context, reg, endpoint string) (string, error) {
	data := url.Values{"registration_id": {reg}}
	r, err := http.NewRequest("POST", endpoint, strings.NewReader(data.Encode()))
	if err != nil {
		return "", fmt.Errorf("pingDevice: %v", err)
	}
	r.Header.Set("content-type", "application/x-www-form-urlencoded")
	// don't send GCM auth key to anyone except Google
	if strings.HasPrefix(endpoint, config.Google.GCM.Endpoint) {
		r.Header.Set("authorization", "key="+config.Google.GCM.Key)
	}

	logf(c, "DEBUG: posting to %q: %v", endpoint, data)
	resp, err := httpClient(c).Do(r)
	if err != nil {
		return "", &pushError{msg: fmt.Sprintf("pingDevice: %v", err), retry: true}
	}
	defer resp.Body.Close()
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return "", &pushError{msg: fmt.Sprintf("pingDevice: %v", err), retry: true}
	}
	logf(c, "pingDevice: response:%s\n%s", resp.Status, body)

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
			msg:   fmt.Sprintf("pingDevice: %s: %s", resp.Status, body),
			retry: resp.StatusCode >= 500,
			after: after,
		}
	}
	if errorStr == "" {
		return q.Get("registration_id"), nil
	}
	pe := &pushError{
		msg:   "pingDevice: " + errorStr,
		after: after,
	}
	switch errorStr {
	case "NotRegistered":
		pe.remove = true
	case "Unavailable", "InternalServerError", "DeviceMessageRateExceeded":
		pe.retry = true
	}
	return "", pe
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
