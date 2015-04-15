package main

//  userPush is user notification configuration.
type userPush struct {
	userID string

	Enabled     bool     `json:"notify" datastore:"on"`
	Subscribers []string `json:"subscribers,omitempty" datastore:"subs,noindex"`
	Endpoints   []string `json:"-" datastore:"urls,noindex"`

	Ext  ioExtPush  `json:"-" datastore:"ext"`
	Pext *ioExtPush `json:"ioext,omitempty" datastore:"-"`
}

// ioExtPush is always embedded in the userPush.
type ioExtPush struct {
	Enabled bool    `json:"-" datastore:"on"`
	Name    string  `json:"name" datastore:"n,noindex"`
	Lat     float64 `json:"lat" datastore:"lat,noindex"`
	Lng     float64 `json:"lng" datastore:"lng,noindex"`
}
