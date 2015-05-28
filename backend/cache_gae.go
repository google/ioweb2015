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

// +build appengine

package main

import (
	"time"

	"golang.org/x/net/context"
	"google.golang.org/appengine/memcache"
)

// cacheInterface implementation using appengine/memcache.
type gaeMemcache struct{}

func (mc *gaeMemcache) set(c context.Context, key string, data []byte, exp time.Duration) error {
	item := &memcache.Item{
		Key:        key,
		Value:      data,
		Expiration: exp,
	}
	return memcache.Set(c, item)
}

func (mc *gaeMemcache) inc(c context.Context, key string, delta int64, initial uint64) (uint64, error) {
	return memcache.Increment(c, key, delta, initial)
}

func (mc *gaeMemcache) get(c context.Context, key string) ([]byte, error) {
	item, err := memcache.Get(c, key)
	if err == memcache.ErrCacheMiss {
		return nil, errCacheMiss
	} else if err != nil {
		return nil, err
	}
	return item.Value, nil
}

func (mc *gaeMemcache) deleleMulti(c context.Context, keys []string) error {
	return memcache.DeleteMulti(c, keys)
}

func (mc *gaeMemcache) flush(c context.Context) error {
	return memcache.Flush(c)
}
