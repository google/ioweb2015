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
	aetInstWg sync.WaitGroup // keeps track of instances being shut down preemptively
	aetInstMu sync.Mutex     // guards aetInst
	aetInst   = make(map[*testing.T]aetest.Instance)
)

func init() {
	isGAEtest = true

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
		aetInstWg.Add(1)
		go func() {
			if err := inst.Close(); err != nil {
				t.Logf("resetTestState: %v", err)
			}
			aetInstWg.Done()
		}()
		delete(aetInst, t)
	}

	// cleanupTests closes all running aetest.Instance instances.
	cleanupTests = func() {
		aetInstMu.Lock()
		tts := make([]*testing.T, 0, len(aetInst))
		for t := range aetInst {
			tts = append(tts, t)
		}
		aetInstMu.Unlock()
		for _, t := range tts {
			resetTestState(t)
		}
		aetInstWg.Wait()
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
