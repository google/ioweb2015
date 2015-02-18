package main

import (
	"bytes"
	"html/template"
	"os"
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
	muMeta sync.Mutex
	// allPages is a map of all pages found in app/templates.
	// It is guarded by muMeta.
	allPages = make(map[string]meta)

	// metaTemplates defines which templates go into a page meta as string values.
	metaTemplates = []string{"title", "mastheadBgClass"}

	// tmplFunc is a map of functions available to all templates.
	tmplFunc = template.FuncMap{
		"safeHTML": func(v string) template.HTML { return template.HTML(v) },
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
	Title, Desc, OgTitle, OgImage string
	Slug, Canonical, Env          string
	Meta                          meta
	Pages                         map[string]meta
}

// meta is a page meta info.
type meta map[string]interface{}

// initTemplates makes all needed initialization to render templates
// It is to be called after initConfig().
func initTemplates() error {
	muMeta.Lock()
	defer muMeta.Unlock()
	var root = filepath.Join(config.Dir, templatesDir)
	return filepath.Walk(root, func(p string, fi os.FileInfo, err error) error {
		if err != nil || p == root || fi.IsDir() {
			return nil
		}
		ext := filepath.Ext(p)
		if ext != ".html" || strings.HasPrefix(fi.Name(), "layout_") {
			return nil
		}
		name := p[len(root)+1 : len(p)-len(ext)]
		t, err := parseTemplate(name, true)
		if err != nil {
			return err
		}
		allPages[name] = metaFromTemplate(t)
		return nil
	})
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
	data.Pages = allPages
	data.Meta = pageMeta(name, tpl)
	data.Title = pageTitle(data.Meta)
	data.Slug = name
	data.Canonical = data.Slug
	if data.Canonical == "home" {
		data.Canonical = "./"
	}
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

// pageTitle extracts "title" property of the page meta and appends defaultTitle to it.
// It returns defaultTitle if meta does not contain "title" or it is of zero value.
func pageTitle(m meta) string {
	title, ok := m["title"].(string)
	if !ok || title == "" {
		return defaultTitle
	}
	return title + " - " + defaultTitle
}

// pageMeta returns either a cached meta from allPages or uses metaFromTemplate().
func pageMeta(name string, t *template.Template) meta {
	muMeta.Lock()
	defer muMeta.Unlock()
	if m, ok := allPages[name]; ok {
		return m
	}
	allPages[name] = metaFromTemplate(t)
	return allPages[name]
}

// metaFromTemplate creates a meta map by executing metaTemplates.
// It always returns a non-nil meta.
func metaFromTemplate(t *template.Template) meta {
	m := make(meta)
	m["hasBeenLoaded"] = false
	for _, n := range metaTemplates {
		b := new(bytes.Buffer)
		if err := t.ExecuteTemplate(b, n, nil); err != nil {
			continue
		}
		m[n] = b.String()
	}
	return m
}
