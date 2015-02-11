package main

import (
	"bytes"
	"html/template"
	"net/http"
	"reflect"
	"regexp"
	"testing"
)

func init() {
	rootDir = "app"
}

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
	e := appEnv
	appEnv = "prod"
	defer func() { appEnv = e }()

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

	rx := `<meta\sproperty="og:image"\scontent="/io2015/images/` + data.OgImage + `">`
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

func TestPageTitle(t *testing.T) {
	table := []struct {
		meta  meta
		title string
	}{
		{meta{}, defaultTitle},
		{meta{"title": "my-title"}, "my-title - " + defaultTitle},
	}
	for i, test := range table {
		title := pageTitle(test.meta)
		if title != test.title {
			t.Errorf("%d: pageTitle(%v) = %q; want %q", i, test.meta, title, test.title)
		}
	}
}

func TestPageMeta(t *testing.T) {
	const smeta = `{{define "meta"}}"title": "my title", "foo": "bar"{{end}}`
	want := meta{"title": "my title", "foo": "bar"}
	tmpl := template.Must(template.New("").Parse(smeta))
	m := pageMeta(tmpl)
	if !reflect.DeepEqual(m, want) {
		t.Errorf("pageMeta(%s) = %#v; want %#v", smeta, m, want)
	}
}
