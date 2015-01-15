package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestServeIOExtEntriesStub(t *testing.T) {
	origEnv := appEnv
	appEnv = "dev"
	defer func() { appEnv = origEnv }()

	cache = newMemoryCache()

	r, _ := http.NewRequest("GET", "/api/extended", nil)
	w := httptest.NewRecorder()
	serveIOExtEntries(w, r)

	if w.Code != http.StatusOK {
		t.Errorf("GET %s: %d; want %d", r.URL.String(), w.Code, http.StatusOK)
	}
	ctype := "application/json;charset=utf-8"
	if w.Header().Get("Content-Type") != ctype {
		t.Errorf("Content-Type: %q; want %q", w.Header().Get("Content-Type"), ctype)
	}
}
