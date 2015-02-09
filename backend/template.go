package main

import (
	"bytes"
	"encoding/json"
	"html/template"
	"path/filepath"

	"golang.org/x/net/context"
)

const (
	// defaultTitle is the site pages default title.
	defaultTitle = "Google I/O 2015"
	// descDefault is the default site description
	descDefault = "Google I/O 2015 brings together developers for an immersive, " +
		"two-day experience focused on exploring the next generation " +
		"of technology, mobile and beyond. Join us online or in person " +
		"May 28-29, 2015."
	// descExperiment is used when users share an experiment link on social.
	descExperiment = "Make music with instruments inspired by material design " +
		"for Google I/O 2015. Play, record and share."
	// images for og:image meta tag
	ogImageDefault    = "io15-color.png"
	ogImageExperiment = "io15-experiment.png"
)

// templateData is the templates context
type templateData struct {
	Title, Desc, Slug, Env, OgImage string
	Meta                            meta
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
	if data.Desc == "" {
		data.Desc = descDefault
	}
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
func pageMeta(t *template.Template) meta {
	m := make(meta)
	b := new(bytes.Buffer)
	b.WriteRune('{')
	if err := t.ExecuteTemplate(b, "meta", nil); err != nil {
		return m
	}
	b.WriteRune('}')
	json.Unmarshal(b.Bytes(), &m)
	return m
}
