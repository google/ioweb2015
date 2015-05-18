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
	"net/http"
	"net/textproto"
	"time"

	"golang.org/x/net/context"
	"golang.org/x/oauth2"
)

// httpTransport returns a suitable HTTP transport for current backend
// hosting environment.
// It uses http.DefaultTransport by default.
var httpTransport = func(_ context.Context) http.RoundTripper {
	return http.DefaultTransport
}

// httpClient create a new HTTP client using httpTransport(),
// setting request timeout to 10 seconds if supported.
func httpClient(c context.Context) *http.Client {
	cl := &http.Client{Transport: httpTransport(c)}
	type canceler interface {
		CancelRequest(*http.Request)
	}
	if _, ok := cl.Transport.(canceler); ok {
		cl.Timeout = 10 * time.Second
	}
	return cl
}

// oauth2Client creates a new HTTP client using oauth2.Transport,
// which is based on httpTransport().
func oauth2Client(c context.Context, ts oauth2.TokenSource) *http.Client {
	t := &oauth2.Transport{
		Source: ts,
		Base:   httpTransport(c),
	}
	return &http.Client{Transport: t}
}

// twitterClient creates a new HTTP client based on oauth2Client() and httpTransport().
func twitterClient(c context.Context) (*http.Client, error) {
	cred := &twitterCredentials{
		key:       config.Twitter.Key,
		secret:    config.Twitter.Secret,
		transport: httpTransport(c),
		cache:     cache,
	}
	return oauth2Client(c, cred), nil
}

// serviceAccountClient creates a new HTTP client using serviceCredentials() and oauth2Client().
func serviceAccountClient(c context.Context, scopes ...string) (*http.Client, error) {
	if config.Google.ServiceAccount.Key == "" {
		// useful for testing
		errorf(c, "serviceAccountClient: no credentials provided; using standard httpClient")
		return httpClient(c), nil
	}
	cred, err := serviceCredentials(c, scopes...)
	if err != nil {
		return nil, err
	}
	return oauth2Client(c, cred), nil
}

func typeMimeHeader(contentType string) textproto.MIMEHeader {
	h := make(textproto.MIMEHeader)
	h.Set("Content-Type", contentType)
	return h
}
