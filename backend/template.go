package main

import (
	"html/template"
	"io"
	"path/filepath"
)

// render executes a template found in 'name' file using
// layout.html as the root template.
// If name does not end with an extension, '.html' is appended.
func render(w io.Writer, name string) error {
	if e := filepath.Ext(name); e == "" {
		name += ".html"
	}

	t := template.New("layout.html").Delims("{%", "%}")
	t = template.Must(t.ParseFiles(
		filepath.Join(rootDir, "templates", "layout.html"),
		filepath.Join(rootDir, "templates", name),
	))

	return t.Execute(w, nil)
}
