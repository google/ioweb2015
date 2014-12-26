package main

import (
	"bytes"
	"testing"
)

func init() {
	rootDir = "app"
}

func TestRenderIndex(t *testing.T) {
	var b bytes.Buffer
	if err := render(&b, "index"); err != nil {
		t.Fatalf("render(index): %v", err)
	}
}
