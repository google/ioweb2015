// Copyright 2015 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
	"bytes"
	"encoding/json"
	"encoding/xml"
	html "html/template"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
	text "text/template"
	"time"

	"golang.org/x/net/context"
)

const (
	// defaultTitle is the site pages default title.
	defaultTitle = "Google I/O 2015"
	// descDefault is the default site description
	descDefault = "Google I/O 2015 brings together developers for an immersive," +
		" two-day experience focused on exploring the next generation of " +
		"technology, mobile and beyond. Join us online or in person May 28-29, " +
		"2015. #io15"
	// descExperiment is used when users share an experiment link on social.
	descExperiment = "Make music with instruments inspired by material design " +
		"for #io15. Play, record and share."
	// images for og:image meta tag
	ogImageDefault    = "images/io15-color.png"
	ogImageExperiment = "images/io15-experiment.png"

	// templatesDir is the templates directory path relative to config.Dir.
	templatesDir = "templates"
)

var (
	// tmplFunc is a map of functions available to all templates.
	tmplFunc = html.FuncMap{
		"safeHTML": func(v string) html.HTML { return html.HTML(v) },
		"safeAttr": safeHTMLAttr,
		"json":     jsonForTemplate,
		"url":      resourceURL,
	}
	// tmplCache caches HTML templates parsed in parseTemplate()
	tmplCache = &templateCache{templates: make(map[string]*html.Template)}

	// don't include these in sitemap
	skipSitemap = []string{
		"embed",
		"upgrade",
		"admin/",
		"debug/",
		"layout_",
		"error_",
	}
)

// templateCache is in-memory cache for parsed templates
type templateCache struct {
	sync.Mutex
	templates map[string]*html.Template
}

// templateData is the templates context
type templateData struct {
	Env          string
	ClientID     string
	Prefix       string
	Slug         string
	Canonical    string
	Title        string
	Desc         string
	OgTitle      string
	OgImage      string
	StartDateStr string
	// livestream youtube video IDs
	LiveIDs []string
}

// easterEgg's link is embedded in pages, for fun.
type easterEgg struct {
	Link    string    `datastore:"link,noindex"`
	Expires time.Time `datastore:"expires,noindex"`
}

func (egg *easterEgg) expired() bool {
	return egg.Expires.Before(time.Now())
}

type sitemap struct {
	XMLName xml.Name `xml:"http://www.sitemaps.org/schemas/sitemap/0.9 urlset"`
	Items   []*sitemapItem
}

type sitemapItem struct {
	XMLName xml.Name   `xml:"url"`
	Loc     string     `xml:"loc"`
	Freq    string     `xml:"changefreq,omitempty"`
	Mod     *time.Time `xml:"lastmod,omitempty"`
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
	data.ClientID = config.Google.Auth.Client
	data.Slug = name
	data.Prefix = config.Prefix
	data.StartDateStr = config.Schedule.Start.In(config.Schedule.Location).Format(time.RFC3339)
	if v, err := scheduleLiveIDs(c, time.Now()); err == nil {
		data.LiveIDs = v
	}
	if data.Title == "" {
		data.Title = pageTitle(tpl)
	}
	if data.OgTitle == "" {
		data.OgTitle = data.Title
	}
	if data.Desc == "" {
		data.Desc = descDefault
	}
	if data.OgImage == "" {
		data.OgImage = ogImageDefault
	}

	var b bytes.Buffer
	if err := tpl.Execute(&b, data); err != nil {
		return nil, err
	}
	return b.Bytes(), nil
}

// renderManifest renders app/templates/manifest.json app manifest.
func renderManifest() ([]byte, error) {
	t, err := text.ParseFiles(filepath.Join(config.Dir, templatesDir, "manifest.json"))
	if err != nil {
		return nil, err
	}
	data := &struct {
		Name        string
		GCMSenderID string
	}{
		Name:        defaultTitle,
		GCMSenderID: config.Google.GCM.Sender,
	}
	var b bytes.Buffer
	if err := t.Execute(&b, data); err != nil {
		return nil, err
	}
	return b.Bytes(), nil
}

// parseTemplate creates a template identified by name, using appropriate layout.
// HTTP error layout is used for name arg prefixed with "error_", e.g. "error_404".
func parseTemplate(name string, partial bool) (*html.Template, error) {
	var layout string
	switch {
	default:
		layout = "layout_full.html"
	case strings.HasPrefix(name, "embed"):
		layout = ""
	case strings.HasPrefix(name, "error_"):
		layout = "layout_error.html"
	case name == "upgrade":
		layout = "layout_bare.html"
	case partial:
		layout = "layout_partial.html"
	}

	key := name + layout
	tmplCache.Lock()
	defer tmplCache.Unlock()
	if t, ok := tmplCache.templates[key]; ok {
		return t, nil
	}

	name += ".html"
	tname := name
	tfiles := []string{filepath.Join(config.Dir, templatesDir, name)}
	if layout != "" {
		tname = layout
		tfiles = append([]string{filepath.Join(config.Dir, templatesDir, layout)}, tfiles...)
	}

	t, err := html.New(tname).Delims("{%", "%}").Funcs(tmplFunc).ParseFiles(tfiles...)
	if err != nil {
		return nil, err
	}
	if !isDev() {
		tmplCache.templates[key] = t
	}
	return t, nil
}

// pageTitle executes "title" template and returns its result or defaultTitle.
func pageTitle(t *html.Template) string {
	b := new(bytes.Buffer)
	if err := t.ExecuteTemplate(b, "title", nil); err != nil || b.Len() == 0 {
		return defaultTitle
	}
	return b.String()
}

// resourceURL returns absolute path to a resource referenced by parts.
// For instance, given config.Prefix = "/myprefix", resourceURL("images", "img.jpg")
// returns "/myprefix/images/img.jpg".
// If the first part starts with http(s)://, it is the returned value.
func resourceURL(parts ...string) string {
	lp := strings.ToLower(parts[0])
	if strings.HasPrefix(lp, "http://") || strings.HasPrefix(lp, "https://") {
		return parts[0]
	}
	p := strings.Join(parts, "/")
	if !strings.HasPrefix(p, config.Prefix) {
		p = config.Prefix + "/" + p
	}
	return path.Clean(p)
}

// jsonForTemplate converts v into a JSON string.
// It returns zero-value string in case of an error.
func jsonForTemplate(v interface{}) string {
	b, err := json.Marshal(v)
	if err != nil {
		return ""
	}
	return string(b)
}

// safeHTMLAttr returns the attribute an HTML element as k=v.
// If v contains double quotes "", the attribute value will be wrapped
// in single quotes '', and vice versa. Defaults to double quotes.
func safeHTMLAttr(k, v string) html.HTMLAttr {
	q := `"`
	if strings.ContainsRune(v, '"') {
		q = "'"
	}
	return html.HTMLAttr(k + "=" + q + v + q)
}

// getSitemap returns a sitemap containing both templated pages
// and schedule session details.
func getSitemap(c context.Context, baseURL *url.URL) (*sitemap, error) {
	items := make([]*sitemapItem, 0)

	// templated pages
	root := filepath.Join(config.Dir, templatesDir)
	err := filepath.Walk(root, func(p string, fi os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		ext := filepath.Ext(p)
		if p == root || fi.IsDir() || ext != ".html" {
			return nil
		}
		name := p[len(root)+1 : len(p)-len(ext)]
		for _, s := range skipSitemap {
			if strings.HasPrefix(name, s) {
				return nil
			}
		}
		freq := "weekly"
		if name == "home" {
			name = ""
			freq = "daily"
		}
		item := &sitemapItem{
			Loc:  baseURL.ResolveReference(&url.URL{Path: name}).String(),
			Freq: freq,
		}
		items = append(items, item)
		return nil
	})
	if err != nil {
		return nil, err
	}

	// schedule
	sched, err := getLatestEventData(c, nil)
	if err != nil {
		return nil, err
	}
	mod := sched.modified.In(time.UTC)
	for id, _ := range sched.Sessions {
		u := baseURL.ResolveReference(&url.URL{Path: "schedule"})
		u.RawQuery = url.Values{"sid": {id}}.Encode()
		item := &sitemapItem{
			Loc:  u.String(),
			Mod:  &mod,
			Freq: "daily",
		}
		items = append(items, item)
	}

	return &sitemap{Items: items}, nil
}
