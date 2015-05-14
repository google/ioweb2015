// +build appengine

package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"appengine/aetest"
	"appengine/user"
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

func TestCheckAdmin(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	h := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})

	config.Whitelist = []string{"white@example.org"}
	config.Admins = []string{"admin@example.org"}

	table := []struct {
		env   string
		email string
		code  int
	}{
		{"stage", "", http.StatusFound},
		{"stage", "dude@example.org", http.StatusForbidden},
		{"stage", "white@example.org", http.StatusForbidden},
		{"stage", "admin@example.org", http.StatusOK},
		{"prod", "", http.StatusFound},
		{"prod", "dude@example.org", http.StatusForbidden},
		{"prod", "white@example.org", http.StatusForbidden},
		{"prod", "admin@example.org", http.StatusOK},
	}
	for _, test := range table {
		config.Env = test.env
		w := httptest.NewRecorder()
		r := newTestRequest(t, "GET", "/", nil)
		if test.email != "" {
			aetest.Login(&user.User{Email: test.email}, r)
		}
		checkAdmin(h).ServeHTTP(w, r)

		if w.Code != test.code {
			t.Errorf("%s: w.Code = %d; want %d %s\nResponse: %s",
				test.email, w.Code, test.code, w.Header().Get("location"), w.Body.String())
		}
		if w.Code == http.StatusOK && w.Body.String() != "ok" {
			t.Errorf("w.Body = %s; want 'ok'", w.Body.String())
		}
	}
}

func TestCheckWhitelist(t *testing.T) {
	if !isGAEtest {
		t.Skipf("not implemented yet; isGAEtest = %v", isGAEtest)
	}
	defer resetTestState(t)
	defer preserveConfig()()

	h := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})

	config.Whitelist = []string{"white@example.org"}
	config.Admins = []string{"admin@example.org"}

	table := []struct {
		env   string
		email string
		code  int
	}{
		{"stage", "", http.StatusFound},
		{"stage", "dude@example.org", http.StatusForbidden},
		{"stage", "white@example.org", http.StatusOK},
		{"stage", "admin@example.org", http.StatusOK},
		{"prod", "", http.StatusFound},
		{"prod", "dude@example.org", http.StatusForbidden},
		{"prod", "white@example.org", http.StatusOK},
		{"prod", "admin@example.org", http.StatusOK},
	}
	for _, test := range table {
		config.Env = test.env
		w := httptest.NewRecorder()
		r := newTestRequest(t, "GET", "/io2015/admin/", nil)
		if test.email != "" {
			aetest.Login(&user.User{Email: test.email}, r)
		}
		checkWhitelist(h).ServeHTTP(w, r)

		if w.Code != test.code {
			t.Errorf("%s: w.Code = %d; want %d %s\nResponse: %s",
				test.email, w.Code, test.code, w.Header().Get("location"), w.Body.String())
		}
		if w.Code == http.StatusOK && w.Body.String() != "ok" {
			t.Errorf("w.Body = %s; want 'ok'", w.Body.String())
		}
	}
}
