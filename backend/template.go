package main

import (
	"bytes"
	"encoding/json"
	"html/template"
	"io"
	"log"
	"path/filepath"
)

// defaultTitle is the site pages default title.
const defaultTitle = "Google I/O 2015"

// meta is a page meta info.
type meta map[string]interface{}

// tmplFunc is a map of functions available to all templates.
var tmplFunc = template.FuncMap{
	"safeHTML": func(v string) template.HTML { return template.HTML(v) },
}

// renderTemplate executes a template found in name.html file
// using either layout_full.html or layout_partial.html as the root template.
func renderTemplate(w io.Writer, name string, partial bool) error {
	var layout string
	if partial {
		layout = "layout_partial.html"
	} else {
		layout = "layout_full.html"
	}

	t, err := template.New(layout).Delims("{%", "%}").Funcs(tmplFunc).ParseFiles(
		filepath.Join(rootDir, "templates", layout),
		filepath.Join(rootDir, "templates", name+".html"),
	)
	if err != nil {
		return err
	}

	m := pageMeta(t)
	data := struct {
		Title string
		Slug  string
		Meta  meta
	}{
		Title: pageTitle(m),
		Slug:  name,
		Meta:  m,
	}
	return t.Execute(w, data)
}

// pageTitle extracts "title" property of the page meta and appends defaultTitle to it.
// It returns defaultTitle if meta does not contain "title" or it is of zero value.
func pageTitle(m meta) string {
	title, ok := m["title"].(string)
	if !ok || title == "" {
		return defaultTitle
	}
	return title + " - " + defaultTitle
}

// pageMeta extracts page meta info by executing "meta" template.
// The template is assumed to be a JSON object body (w/o {}).
// Returns empty meta if template execution fails.
func pageMeta(t *template.Template) (m meta) {
	m = make(meta)

	b := new(bytes.Buffer)
	b.WriteRune('{')
	if err := t.ExecuteTemplate(b, "meta", nil); err != nil {
		return
	}
	b.WriteRune('}')

	if err := json.Unmarshal(b.Bytes(), &m); err != nil {
		log.Printf("pageMeta: %v", err)
	}
	return
}
