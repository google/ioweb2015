package main

import (
	"encoding/json"
	"os"
	"sort"
)

// config is a global backend config,
// usually obtained by reading a server config file in an init() func.
var config appConfig

// isDev returns true if current app environment is "dev".
func isDev() bool {
	return config.Env == "dev"
}

// isProd returns true if current app environment is "prod".
func isProd() bool {
	return config.Env == "prod"
}

// appConfig defines the backend config file structure.
type appConfig struct {
	// App environment: dev, stage or prod
	Env string `json:"env"`
	// Frontend root dir
	Dir string `json:"dir"`
	// Standalone server address to listen on
	Addr string `json:"addr"`
	// HTTP prefix
	Prefix string `json:"prefix"`
	// User emails allowed in staging
	Whitelist []string
	// I/O Extended events feed
	IoExtFeedURL string `json:"ioExtFeedUrl"`
	// Twitter credentials
	Twitter struct {
		Account     string `json:"account"`
		Filter      string `json:"filter"`
		Key         string `json:"key"`
		Secret      string `json:"secret"`
		TokenURL    string `json:"tokenUrl"`
		TimelineURL string `json:"timelineUrl"`
	} `json:"twitter"`
	// Google credentials
	Google struct {
		TokenURL       string `json:"tokenUrl"`
		ServiceAccount struct {
			Key   string `json:"private_key"`
			Email string `json:"client_email"`
		} `json:"serviceAccount"`
	} `json:"google"`
}

// initConfig reads server config file into the config global var.
// Args provided to this func take precedence over config file values.
func initConfig(configPath, addr string) {
	file, err := os.Open(configPath)
	if err != nil {
		panic("initConfig: error locating " + configPath)
	}
	defer file.Close()
	if err := json.NewDecoder(file).Decode(&config); err != nil {
		panic("initConfig: " + err.Error())
	}
	if addr != "" {
		config.Addr = addr
	}
	if config.Prefix == "" || config.Prefix[0] != '/' {
		config.Prefix = "/" + config.Prefix
	}
	sort.Strings(config.Whitelist)
}
