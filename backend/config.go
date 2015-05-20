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
	"encoding/json"
	"os"
	"sort"
	"strings"
	"time"
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

// isDevServer returns true if the app is currently running in a dev server.
// This is orthogonal to isDev/Staging/Prod. For instance, the app can be running
// on dev server and be in "prod" mode at the same time. In this case
// both isProd() and isDevServer() return true.
func isDevServer() bool {
	return os.Getenv("RUN_WITH_DEVAPPSERVER") != ""
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
	// App admins
	Admins []string
	// I/O Extended events feed
	IoExtFeedURL string `json:"ioExtFeedUrl"`
	// Endpoint to ping external/extra parties about certain updates
	// Currently it is only user schedule
	ExtPingURL string `json:"extPingUrl"`
	// used for SW tokens
	Secret string `json:"secret"`
	// A shared secret to identify requests from GCS and gdrive
	SyncToken string `json:"synct"`

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
		GCM struct {
			Sender   string `json:"sender"`
			Key      string `json:"key"`
			Endpoint string `json:"endpoint"`
		} `json:"gcm"`
		Drive struct {
			Filename  string `json:"filename"`
			FilesURL  string `json:"files_url"`
			UploadURL string `json:"upload_url"`
		} `json:"drive"`
	} `json:"google"`

	// Event schedule settings
	Schedule struct {
		Start       time.Time `json:"start"`
		Timezone    string    `json:"timezone"`
		Location    *time.Location
		ManifestURL string `json:"manifest"`
	} `json:"schedule"`

	// Feedback survey settings
	Survey struct {
		ID       string `json:"id"`
		Endpoint string `json:"endpoint"`
		Key      string `json:"key"`
		Code     string `json:"code"`
		Reg      string `json:"reg"`
		// Session IDs map
		Smap map[string]string
		// Don't accept feedback for these sessions
		Disabled []string
		// Question answers map
		Qmap struct {
			Q1 struct {
				Name    string
				Answers map[string]string
			}
			Q2 struct {
				Name    string
				Answers map[string]string
			}
			Q3 struct {
				Name    string
				Answers map[string]string
			}
			Q4 struct {
				Name    string
				Answers map[string]string
			}
			Q5 struct {
				Name string
			}
		}
	} `json:"survey"`
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
	if config.Schedule.Location, err = time.LoadLocation(config.Schedule.Timezone); err != nil {
		return err
	}
	if addr != "" {
		config.Addr = addr
	}
	if config.Prefix == "" || config.Prefix[0] != '/' {
		config.Prefix = "/" + config.Prefix
	}
	sort.Strings(config.Whitelist)
	sort.Strings(config.Admins)
	sort.Strings(config.Survey.Disabled)
	if config.Survey.Smap == nil {
		config.Survey.Smap = make(map[string]string)
	}
	return nil
}

// isWhitelisted returns true if either email or its domain
// is in the config.Whitelist.
// All admins are whitelisted.
func isWhitelisted(email string) bool {
	if isAdmin(email) {
		return true
	}
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

// isAdmin returns true if email is in config.Admins.
// It doesn't test for email's @domain address; only complete emails will match.
// All users are admins on dev server.
func isAdmin(email string) bool {
	if isDev() {
		return true
	}
	i := sort.SearchStrings(config.Admins, email)
	return i < len(config.Admins) && config.Admins[i] == email
}
