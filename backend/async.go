// +build !appengine

package main

import (
	"errors"
	"time"

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

// pingDevicesAsync schedules len(endpoints) tasks of /ping-device.
// If scheduling fails for some endpoints, those will be in returned values
// along with a non-nil error.
// d specifies the duration the tasker must wait before executing the task.
// TODO: regs are going away with Chrome 44.
func pingDevicesAsync(c context.Context, uid string, regs, endpoints []string, d time.Duration) ([]string, []string, error) {
	return nil, nil, errors.New("not implemented")
}

// pingExtPartyAsync notifies extra parties at config.ExtPingURL about data updates.
func pingExtPartyAsync(c context.Context, key string) error {
	return errors.New("not implemented")
}
