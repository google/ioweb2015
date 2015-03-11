package main

import (
	"bytes"
	"net/http"
	"regexp"
	"testing"
)

func TestRenderTemplate(t *testing.T) {
	table := []*struct {
		tmpl    string
		partial bool
	}{
		{"home", false},
		{"home", true},
		{"about", false},
		{"about", true},
	}
	for i, test := range table {
		r, _ := http.NewRequest("GET", "/dummy", nil)
		c := newContext(r, new(bytes.Buffer))
		if _, err := renderTemplate(c, test.tmpl, test.partial, nil); err != nil {
			t.Fatalf("%d: renderTemplate(%v, %q, %v): %v", i, c, test.tmpl, test.partial, err)
		}
	}
}

func TestRenderEnv(t *testing.T) {
	revert := overrideEnv("prod")
	defer revert()
	req, _ := http.NewRequest("GET", "/about", nil)
	c := newContext(req, new(bytes.Buffer))

	out, err := renderTemplate(c, "about", false, nil)
	if err != nil {
		t.Fatalf("renderTemplate(..., about, false): %v", err)
	}

	rx := `window\.ENV\s+=\s+"prod";`
	if matched, err := regexp.Match(rx, out); !matched || err != nil {
		t.Errorf("didn't match %s to: %s (%v)", rx, string(out), err)
	}
}

func TestRenderOgImage(t *testing.T) {
	req, _ := http.NewRequest("GET", "/about", nil)
	c := newContext(req, new(bytes.Buffer))

	data := &templateData{OgImage: ogImageExperiment}
	out, err := renderTemplate(c, "about", false, data)
	if err != nil {
		t.Fatalf("renderTemplate(..., about, false): %v", err)
	}

	rx := `<meta\sproperty="og:image"\scontent="` + config.Prefix + `/images/` + data.OgImage + `">`
	if matched, err := regexp.Match(rx, out); !matched || err != nil {
		t.Errorf("didn't match %s to: %s (%v)", rx, string(out), err)
	}
}

func TestRenderOgDesc(t *testing.T) {
	req, _ := http.NewRequest("GET", "/about?experiment", nil)
	c := newContext(req, new(bytes.Buffer))

	data := &templateData{Desc: descExperiment}
	out, err := renderTemplate(c, "about", false, data)
	if err != nil {
		t.Fatalf("renderTemplate(..., about, false): %v", err)
	}

	rx := `<meta\sproperty="og:description"\scontent="` + descExperiment + `">`
	if matched, err := regexp.Match(rx, out); !matched || err != nil {
		t.Errorf("didn't match %s to: %s (%v)", rx, string(out), err)
	}
}
