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
	"strings"
	"testing"
)

func TestRenderTemplate(t *testing.T) {
	defer resetTestState(t)
	table := []*struct {
		tmpl    string
		partial bool
	}{
		{"home", false},
		{"home", true},
		{"about", false},
		{"about", true},
	}
	for i, test := range table {
		r := newTestRequest(t, "GET", "/dummy", nil)
		c := newContext(r)
		if _, err := renderTemplate(c, test.tmpl, test.partial, nil); err != nil {
			t.Fatalf("%d: renderTemplate(%v, %q, %v): %v", i, c, test.tmpl, test.partial, err)
		}
	}
}

func TestRenderTemplateData(t *testing.T) {
	defer resetTestState(t)
	defer preserveConfig()()
	config.Env = "prod"
	config.Prefix = "/root"
	config.Google.Auth.Client = "dummy-client-id"

	r := newTestRequest(t, "GET", "/about", nil)
	c := newContext(r)

	data := &templateData{
		OgImage: "some-image.png",
		Desc:    "dummy description",
	}
	out, err := renderTemplate(c, "about", false, data)
	if err != nil {
		t.Fatalf("renderTemplate(about, false): %v", err)
	}
	sout := string(out)

	subs := []string{
		`window.ENV = "prod"`,
		`window.PREFIX = "/root"`,
		`<meta property="og:image" content="/root/some-image.png">`,
		`<meta property="og:description" content="dummy description">`,
		`google-signin clientId="dummy-client-id"`,
	}

	for _, s := range subs {
		if !strings.Contains(sout, s) {
			t.Errorf("%s doesn't contain %s", out, s)
		}
	}
}
