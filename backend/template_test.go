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
		urlpath string
		partial bool
	}{
		{"/", false},
		{"/", true},
		{"/about", false},
		{"/about", true},
	}
	for i, test := range table {
		r, _ := http.NewRequest("GET", test.urlpath, nil)
		var b bytes.Buffer
		c := newContext(r, &b)
		if err := renderTemplate(c, test.urlpath, test.partial, nil); err != nil {
			t.Fatalf("%d: renderTemplate(%v, %q, %v): %v", i, c, test.urlpath, test.partial, err)
		}
	}
}

func TestRenderEnv(t *testing.T) {
	e := appEnv
	appEnv = "prod"
	defer func() { appEnv = e }()

	req, _ := http.NewRequest("GET", "/about", nil)
	var b bytes.Buffer
	c := newContext(req, &b)

	if err := renderTemplate(c, "about", false, nil); err != nil {
		t.Fatalf("renderTemplate(..., about, false): %v", err)
	}

	rx := `window\.ENV\s+=\s+"prod";`
	if matched, err := regexp.Match(rx, b.Bytes()); !matched || err != nil {
		t.Errorf("didn't match %s to: %s (%v)", rx, b.String(), err)
	}
}

func TestRenderOgImage(t *testing.T) {
	req, _ := http.NewRequest("GET", "/about", nil)
	var b bytes.Buffer
	c := newContext(req, &b)

	data := &templateData{OgImage: ogImageExperiment}
	if err := renderTemplate(c, "about", false, data); err != nil {
		t.Fatalf("renderTemplate(..., about, false): %v", err)
	}

	rx := `<meta\sproperty="og:image"\scontent="images/` + data.OgImage + `">`
	if matched, err := regexp.Match(rx, b.Bytes()); !matched || err != nil {
		t.Errorf("didn't match %s to: %s (%v)", rx, b.String(), err)
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
