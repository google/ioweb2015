package main

import (
	"encoding/json"
	"os"
	"sort"
	"strings"
)

// config is a global backend config,
// usually obtained by reading a server config file in an init() func.
var config appConfig

// isDev returns true if current app environment is in a dev mode.
func isDev() bool {
	return !isStaging() && !isProd()
}

// isStaging returns true if current app environment is "stage".
func isStaging() bool {
	return config.Env == "stage"
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
		VerifyURL      string `json:"verifyUrl"`
		CertURL        string `json:"certUrl"`
		ServiceAccount struct {
			Key   string `json:"private_key"`
			Email string `json:"client_email"`
		} `json:"serviceAccount"`
		Auth struct {
			Client string `json:"client"`
			Secret string `json:"secret"`
		} `json:"auth"`
	} `json:"google"`
}

// initConfig reads server config file into the config global var.
// Args provided to this func take precedence over config file values.
func initConfig(configPath, addr string) error {
	file, err := os.Open(configPath)
	if err != nil {
		return err
	}
	defer file.Close()
	if err := json.NewDecoder(file).Decode(&config); err != nil {
		return err
	}
	if addr != "" {
		config.Addr = addr
	}
	if config.Prefix == "" || config.Prefix[0] != '/' {
		config.Prefix = "/" + config.Prefix
	}
	sort.Strings(config.Whitelist)
	return nil
}

// isWhitelisted returns true if either email or its domain
// is in the config.Whitelist.
func isWhitelisted(email string) bool {
	i := sort.SearchStrings(config.Whitelist, email)
	if i < len(config.Whitelist) && config.Whitelist[i] == email {
		return true
	}
	// no more checks can be done if this is a @domain
	// or an invalid email address.
	i = strings.Index(email, "@")
	if i <= 0 {
		return false
	}
	// check the @domain of this email
	return isWhitelisted(email[i:])
}
