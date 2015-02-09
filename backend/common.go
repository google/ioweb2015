package main

import (
	"encoding/json"
	"io"
	"os"
	"path/filepath"

	"golang.org/x/net/context"
)

// config is a global backend config,
// usually obtained by reading a config.yaml file in an init() func.
var config appConfig

// appConfig defines the backend config file structure.
type appConfig struct {
	Twitter struct {
		Account string `json:"account"`
		Key     string `json:"key"`
		Secret  string `json:"secret"`
	} `json:"twitter"`
}

// initConfig reads rootDir/../server.config into config var.
func initConfig() {
	p := filepath.Join(rootDir, "..", "server.config")
	file, err := os.Open(p)
	if err != nil {
		panic("initConfig: error locating " + p)
	}
	if err := json.NewDecoder(file).Decode(&config); err != nil {
		panic("initConfig: " + err.Error())
	}
}

// ctxKey is a custom type for context.Context values.
type ctxKey int

const (
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
