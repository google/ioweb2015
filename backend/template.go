package main

import (
	"bytes"
	"html/template"
	"io"
	"path/filepath"
)

// defaultTitle is the site pages default title
const defaultTitle = "Google I/O 2015"

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

	data := struct{ Title, Slug string }{
		Title: pageTitle(t),
		Slug:  name,
	}
	return t.Execute(w, data)
}

// pageTitle executes "title" template of the given template set and returns the result,
// appending defaultTitle separated by a ' - '.
// In the absence of the template or execution error, defaultTitle is returned.
func pageTitle(t *template.Template) string {
	tb := new(bytes.Buffer)
	if err := t.ExecuteTemplate(tb, "title", nil); err != nil {
		return defaultTitle
	}

	title := tb.String()
	if title != "" {
		title += " - " + defaultTitle
	}
	return title
}
