package main

import (
	"bytes"
	"html/template"
	"reflect"
	"regexp"
	"testing"
)

func init() {
	rootDir = "app"
}

func TestRenderFull(t *testing.T) {
	var b bytes.Buffer
	if err := renderTemplate(&b, "dev", "about", false); err != nil {
		t.Fatalf("renderTemplate(dev, about, false): %v", err)
	}
}

func TestRenderPartial(t *testing.T) {
	var b bytes.Buffer
	if err := renderTemplate(&b, "dev", "about", true); err != nil {
		t.Fatalf("renderTemplate(dev, about, true): %v", err)
	}
}

func TestRenderEnv(t *testing.T) {
	var b bytes.Buffer
	if err := renderTemplate(&b, "prod", "home", false); err != nil {
		t.Fatalf("renderTemplate(prod, home, false): %v", err)
	}

	r := `window\.ENV\s+=\s+"prod";`
	if matched, err := regexp.Match(r, b.Bytes()); !matched || err != nil {
		t.Errorf("didn't match %s to: %s (%v)", r, b.String(), err)
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
