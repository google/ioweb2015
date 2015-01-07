package main

import (
	"bytes"
	"html/template"
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
	table := []struct{ template, out string }{
		{``, defaultTitle},
		{`{{define "title"}}my-title{{end}}`, "my-title - " + defaultTitle},
	}
	for i, test := range table {
		tmpl, err := template.New("").Parse(test.template)
		if err != nil {
			t.Errorf("%d: template.Parse(%q): %v", i, test.template, err)
			continue
		}
		title := pageTitle(tmpl)
		if title != test.out {
			t.Errorf("%d: pageTitle(%q) = %q; want %q", i, test.template, title, test.out)
		}
	}
}
