// +build appengine

package main

import (
	"fmt"
	"net/url"
	"path"
	"strings"
	"time"

	"golang.org/x/net/context"
	"google.golang.org/appengine"
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

// pingUserAsync creates an async job to send a push notification to user devices.
// sessions are session IDs used to compare against user bookmarks.
// TODO: add ioext support
func pingUserAsync(c context.Context, uid string, sessions []string) error {
	p := path.Join(config.Prefix, "/task/ping-user")
	t := taskqueue.NewPOSTTask(p, url.Values{
		"uid":      {uid},
		"sessions": {strings.Join(sessions, " ")},
	})
	_, err := taskqueue.Add(c, t, "")
	return err
}

// pingDevicesAsync schedules len(endpoints) tasks of /ping-device.
// If scheduling fails for some endpoints, those will be in returned values
// along with a non-nil error.
// d specifies the duration the tasker must wait before executing the task.
// TODO: regs are going away with Chrome 44.
func pingDevicesAsync(c context.Context, uid string, regs, endpoints []string, d time.Duration) ([]string, []string, error) {
	if len(regs) == 0 {
		return nil, nil, nil
	}
	p := path.Join(config.Prefix, "/task/ping-device")
	jobs := make([]*taskqueue.Task, 0, len(endpoints))
	for i, endpoint := range endpoints {
		t := taskqueue.NewPOSTTask(p, url.Values{
			"uid":      {uid},
			"endpoint": {endpoint},
			"rid":      {regs[i]},
		})
		t.Delay = d
		jobs = append(jobs, t)
	}
	_, err := taskqueue.AddMulti(c, jobs, "")
	merr, noerr := err.(appengine.MultiError)
	if noerr {
		return nil, nil, nil
	}

	errRegs, errEndpoints := make([]string, 0), make([]string, 0)
	for i, e := range merr {
		if e == nil {
			continue
		}
		errRegs = append(errRegs, regs[i])
		errEndpoints = append(errEndpoints, endpoints[i])
	}
	return errRegs, errEndpoints, fmt.Errorf("pingDevicesAsync: %v", err)
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
