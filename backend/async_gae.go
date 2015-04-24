// +build appengine

package main

import (
	"net/url"
	"path"
	"strings"

	"golang.org/x/net/context"
	"google.golang.org/appengine/taskqueue"
)

// notifySubscriberAsync creates an async job to begin notify subscribers.
func notifySubscribersAsync(c context.Context, d *dataChanges) error {
	skeys := make([]string, 0, len(d.Sessions))
	for id, _ := range d.Sessions {
		skeys = append(skeys, id)
	}
	p := path.Join(config.Prefix, "/task/notify-subscribers")
	// TODO: add ioext to the payload
	t := taskqueue.NewPOSTTask(p, url.Values{
		"sessions": {strings.Join(skeys, " ")},
	})
	_, err := taskqueue.Add(c, t, "")
	return err
}

// pingUserAsync creates an async job to send a push notification to user uid.
// skeys are session IDs used to compare against user bookmarks.
// TODO: add ioext support
func pingUserAsync(c context.Context, uid string, skeys []string) error {
	p := path.Join(config.Prefix, "/task/ping-user")
	// TODO: add ioext to the payload
	t := taskqueue.NewPOSTTask(p, url.Values{
		"uid":      {uid},
		"sessions": {strings.Join(skeys, " ")},
	})
	_, err := taskqueue.Add(c, t, "")
	return err
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
