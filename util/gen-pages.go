// Copyright 2014 Google Inc. All Rights Reserved.
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

// This program generates a pages meta data needed by the frontend router.
// It is done automatically by gulp tasks but you can also run it manually:
// go run util/gen-pages.go > app/scripts/pages.js

package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"html/template"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

var (
	// flags
	templatesRoot = flag.String("d", "app/templates", "templates dir")

	// metaTemplates defines which templates go into a page meta as string values.
	metaTemplates = []string{"title", "mastheadBgClass", "defaultSubpage", "selectedSubpage"}
	// these are treated separately
	skipFiles = []string{"embed.html"}
)

type pageMeta map[string]interface{}

func main() {
	sort.Strings(skipFiles)
	pages := make(map[string]pageMeta)

	err := filepath.Walk(*templatesRoot, func(p string, fi os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if fi.IsDir() && (fi.Name() == "debug" || fi.Name() == "admin") {
			return filepath.SkipDir
		}
		if p == *templatesRoot || fi.IsDir() || ignoreFile(fi.Name()) {
			return nil
		}
		ext := filepath.Ext(p)
		if ext != ".html" || strings.HasPrefix(fi.Name(), "layout_") {
			return nil
		}
		name := p[len(*templatesRoot)+1 : len(p)-len(ext)]
		t, err := template.New("").Delims("{%", "%}").ParseFiles(p)
		if err != nil {
			return err
		}
		pages[name] = metaFromTemplate(t)
		return nil
	})

	if err != nil {
		log.Fatal(err)
	}

	var b []byte
	if b, err = json.MarshalIndent(pages, "", "  "); err != nil {
		log.Fatal(err)
	}

	fmt.Fprintf(os.Stdout, "// auto-generated - do not modify\nIOWA.PAGES = %s;\n", b)
}

func metaFromTemplate(t *template.Template) pageMeta {
	m := make(pageMeta)
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

func ignoreFile(name string) bool {
	i := sort.SearchStrings(skipFiles, name)
	return i < len(skipFiles) && skipFiles[i] == name
}
