package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestServeIOExtEntriesStub(t *testing.T) {
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

func TestServeTemplate(t *testing.T) {
	const ctype = "text/html;charset=utf-8"
	revert := overridePrefix("/root")
	defer revert()
	table := []struct{ path, slug, canonical string }{
		{"/", "home", "/root/"},
		{"/home?experiment", "home", "/root/"},
		{"/about", "about", "/root/about"},
		{"/about?experiment", "about", "/root/about"},
		{"/schedule", "schedule", "/root/schedule"},
		{"/onsite", "onsite", "/root/onsite"},
		{"/offsite", "offsite", "/root/offsite"},
		{"/registration", "registration", "/root/registration"},
		{"/faq", "faq", "/root/faq"},
		{"/form", "form", "/root/form"},
	}
	for i, test := range table {
		r, _ := http.NewRequest("GET", test.path, nil)
		w := httptest.NewRecorder()
		serveTemplate(w, r)

		if w.Code != http.StatusOK {
			t.Errorf("%d: GET %s = %d; want %d", i, test.path, w.Code, http.StatusOK)
			continue
		}
		if v := w.Header().Get("Content-Type"); v != ctype {
			t.Errorf("%d: Content-Type: %q; want %q", i, v, ctype)
		}
		if w.Header().Get("Cache-Control") == "" {
			t.Errorf("%d: want cache-control header", i)
		}

		body := string(w.Body.String())

		tag := `<body id="page-` + test.slug + `"`
		if !strings.Contains(body, tag) {
			t.Errorf("%d: %s does not contain %s", i, body, tag)
		}
		tag = `<link rel="canonical" href="` + test.canonical + `"`
		if !strings.Contains(body, tag) {
			t.Errorf("%d: %s does not contain %s", i, body, tag)
		}
	}
}

func TestServeTemplateRedirect(t *testing.T) {
	table := []struct{ start, redirect string }{
		{"/about/", "/about"},
		{"/one/two/", "/one/two"},
	}
	for i, test := range table {
		r, _ := http.NewRequest("GET", test.start, nil)
		w := httptest.NewRecorder()
		serveTemplate(w, r)

		if w.Code != http.StatusFound {
			t.Fatalf("%d: GET %s: %d; want %d", i, test.start, w.Code, http.StatusFound)
		}
		redirect := config.Prefix + test.redirect
		if loc := w.Header().Get("Location"); loc != redirect {
			t.Errorf("%d: Location: %q; want %q", i, loc, redirect)
		}
	}
}

func TestServeTemplate404(t *testing.T) {
	r, _ := http.NewRequest("GET", "/a-thing-that-is-not-there", nil)
	w := httptest.NewRecorder()
	serveTemplate(w, r)
	if w.Code != http.StatusNotFound {
		t.Errorf("GET %s: %d; want %d", r.URL.String(), w.Code, http.StatusNotFound)
	}
	const ctype = "text/html;charset=utf-8"
	if v := w.Header().Get("Content-Type"); v != ctype {
		t.Errorf("Content-Type: %q; want %q", v, ctype)
	}
	if v := w.Header().Get("Cache-Control"); v != "" {
		t.Errorf("don't want Cache-Control: %q", v)
	}
}
