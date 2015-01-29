package main

import (
	"io"

	"golang.org/x/net/context"
)

type ctxKey int

const (
	// context.Context value keys
	ctxKeyEnv ctxKey = iota
	ctxKeyGAEContext
	ctxKeyWriter
)

// env returns current app environment: "dev", "stage" or "prod".
// The environment is determined by either APP_ENV process environment
// or '-env' command line flag.
func env(c context.Context) string {
	e, ok := c.Value(ctxKeyEnv).(string)
	if !ok {
		e = "dev"
	}
	return e
}

// writer returns a response writer associated with the give context c.
func writer(c context.Context) io.Writer {
	w, _ := c.Value(ctxKeyWriter).(io.Writer)
	return w
}
