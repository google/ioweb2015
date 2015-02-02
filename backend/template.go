package main

import (
	"bytes"
	"encoding/json"
	"html/template"
	"log"
	"path/filepath"

	"golang.org/x/net/context"
)

const (
	// defaultTitle is the site pages default title.
	defaultTitle = "Google I/O 2015"
	// images for og:image meta tag
	ogImageDefault    = "io15-color.png"
	ogImageExperiment = "io15-experiment.png"
)

// templateData is the templates context
type templateData struct {
	Title, Slug, Env, OgImage string
	Meta                      meta
}

// meta is a page meta info.
type meta map[string]interface{}

// tmplFunc is a map of functions available to all templates.
var tmplFunc = template.FuncMap{
	"safeHTML": func(v string) template.HTML { return template.HTML(v) },
}

// renderTemplate executes a template found in name.html file
// using either layout_full.html or layout_partial.html as the root template.
// env is the app current environment: "dev", "stage" or "prod".
func renderTemplate(c context.Context, name string, partial bool, data *templateData) error {
	if name == "/" || name == "" {
		name = "home"
	}

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
	if data == nil {
		data = &templateData{}
	}
	if data.Env == "" {
		data.Env = env(c)
	}
	data.Meta = m
	data.Title = pageTitle(m)
	data.Slug = name
	if data.OgImage == "" {
		data.OgImage = ogImageDefault
	}
	return t.Execute(writer(c), data)
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
