// +build !appengine

package main

import (
	"errors"

	"golang.org/x/net/context"
)

// notifySubscriberAsync creates an async job to begin notify subscribers.
func notifySubscribersAsync(c context.Context, d *dataChanges) error {
	return errors.New("not implemented")
}

// pingUserAsync creates an async job to send a push notification to user uid.
// skeys are session IDs used to compare against user bookmarks.
// TODO: add ioext support
func pingUserAsync(c context.Context, uid string, skeys []string) error {
	return errors.New("not implemented")
}
