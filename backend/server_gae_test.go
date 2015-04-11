// +build appengine

package main

import (
	"io"
	"net/http"
	"sync"
	"testing"

	"appengine/aetest"
)

var (
	aetInstMu sync.Mutex
	aetInst   = make(map[*testing.T]aetest.Instance)
)

func init() {
	// newTestRequest returns a new *http.Request associated with an aetest.Instance
	// of test state t.
	newTestRequest = func(t *testing.T, method, url string, body io.Reader) *http.Request {
		req, err := aetInstance(t).NewRequest(method, url, body)
		if err != nil {
			t.Fatalf("newTestRequest(%q, %q): %v", err)
		}
		return req
	}

	// resetTestState closes aetest.Instance associated with a test state t.
	resetTestState = func(t *testing.T) {
		aetInstMu.Lock()
		defer aetInstMu.Unlock()
		inst, ok := aetInst[t]
		if !ok {
			return
		}
		err := inst.Close()
		if err != nil {
			t.Logf("resetTestState: %v", err)
		}
		delete(aetInst, t)
	}

	// cleanupTests closes all running aetest.Instance instances.
	cleanupTests = func() {
		aetInstMu.Lock()
		defer aetInstMu.Unlock()
		for t, inst := range aetInst {
			if err := inst.Close(); err != nil {
				t.Logf("cleanupTests: %v", err)
			}
			delete(aetInst, t)
		}
	}
}

// aetInstance returns an aetest.Instance associated with the test state t
// or creates a new one.
func aetInstance(t *testing.T) aetest.Instance {
	aetInstMu.Lock()
	defer aetInstMu.Unlock()
	if inst, ok := aetInst[t]; ok {
		return inst
	}
	inst, err := aetest.NewInstance(nil)
	if err != nil {
		t.Fatalf("aetest.NewInstance: %v", err)
	}
	aetInst[t] = inst
	return inst
}
