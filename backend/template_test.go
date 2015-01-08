package main

import (
	"bytes"
	"html/template"
	"reflect"
	"testing"
)

func init() {
	rootDir = "app"
}

func TestRenderFull(t *testing.T) {
	var b bytes.Buffer
	if err := renderTemplate(&b, "about", false); err != nil {
		t.Fatalf("render(about): %v", err)
	}
}

func TestRenderPartial(t *testing.T) {
	var b bytes.Buffer
	if err := renderTemplate(&b, "about", true); err != nil {
		t.Fatalf("render(about): %v", err)
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
