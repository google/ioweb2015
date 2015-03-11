package main

import (
	"bytes"
	"html/template"
	"path"
	"path/filepath"
	"strings"
	"sync"

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

	// templatesDir is the templates directory path relative to config.Dir.
	templatesDir = "templates"
)

var (
	// tmplFunc is a map of functions available to all templates.
	tmplFunc = template.FuncMap{
		"safeHTML":  func(v string) template.HTML { return template.HTML(v) },
		"canonical": canonicalURL,
	}
	// tmplCache caches HTML templates parsed in parseTemplate()
	tmplCache = &templateCache{templates: make(map[string]*template.Template)}
)

// templateCache is in-memory cache for parsed templates
type templateCache struct {
	sync.Mutex
	templates map[string]*template.Template
}

// templateData is the templates context
type templateData struct {
	Env     string
	Prefix  string
	Slug    string
	Title   string
	Desc    string
	OgTitle string
	OgImage string
}

// renderTemplate executes a template found in name.html file
// using either layout_full.html or layout_partial.html as the root template.
// env is the app current environment: "dev", "stage" or "prod".
func renderTemplate(c context.Context, name string, partial bool, data *templateData) ([]byte, error) {
	tpl, err := parseTemplate(name, partial)
	if err != nil {
		return nil, err
	}
	if data == nil {
		data = &templateData{}
	}
	if data.Env == "" {
		data.Env = config.Env
	}
	data.Title = pageTitle(tpl)
	data.Slug = name
	data.Prefix = config.Prefix
	if data.Desc == "" {
		data.Desc = descDefault
	}
	if data.OgImage == "" {
		data.OgImage = ogImageDefault
	}
	if data.OgTitle == "" {
		data.OgTitle = data.Title
	}

	var b bytes.Buffer
	if err := tpl.Execute(&b, data); err != nil {
		return nil, err
	}
	return b.Bytes(), nil
}

// parseTemplate creates a template identified by name, using appropriate layout.
// HTTP error layout is used for name arg prefixed with "error_", e.g. "error_404".
func parseTemplate(name string, partial bool) (*template.Template, error) {
	var layout string
	switch {
	case strings.HasPrefix(name, "error_"):
		layout = "layout_error.html"
	case name == "upgrade":
		layout = "layout_bare.html"
	case partial:
		layout = "layout_partial.html"
	default:
		layout = "layout_full.html"
	}

	key := name + layout
	tmplCache.Lock()
	defer tmplCache.Unlock()
	if t, ok := tmplCache.templates[key]; ok {
		return t, nil
	}

	t, err := template.New(layout).Delims("{%", "%}").Funcs(tmplFunc).ParseFiles(
		filepath.Join(config.Dir, templatesDir, layout),
		filepath.Join(config.Dir, templatesDir, name+".html"),
	)
	if err != nil {
		return nil, err
	}
	tmplCache.templates[key] = t
	return t, nil
}

// pageTitle executes "title" template and returns its result or defaultTitle.
func pageTitle(t *template.Template) string {
	b := new(bytes.Buffer)
	if err := t.ExecuteTemplate(b, "title", nil); err != nil || b.Len() == 0 {
		return defaultTitle
	}
	return b.String()
}

// canonicalURL returns a canonical URL of path p.
// Relative paths are based off of config.Prefix.
func canonicalURL(p string) string {
	if p == "home" || p == "/" || p == "" {
		return config.Prefix + "/"
	}
	return path.Join(config.Prefix, p)
}
