package main

import (
	"io"
	"io/ioutil"
	"path/filepath"

	"golang.org/x/net/context"
	yaml "gopkg.in/yaml.v2"
)

// config is a global backend config,
// usually obtained by reading a config.yaml file in an init() func.
var config appConfig

// appConfig defines the backend config file structure.
type appConfig struct {
	TwitterAccount string `yaml:"twitterAccount"`
	TwitterKey     string `yaml:"twitterKey"`
	TwitterSecret  string `yaml:"twitterSecret"`
}

// initConfig reads rootDir/../config.yaml into config var.
func initConfig() {
	file := filepath.Join(rootDir, "..", "config.yaml")
	data, err := ioutil.ReadFile(file)
	if err != nil {
		panic("initConfig: " + err.Error())
	}
	if err := yaml.Unmarshal(data, &config); err != nil {
		panic("parse config: " + err.Error())
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
