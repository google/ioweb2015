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
	"encoding/binary"
	"errors"
	"fmt"
	"sort"
	"sync"
	"time"

	"golang.org/x/net/context"
)

var (
	// cache is the instance used by the program,
	// initialized by the standalone server's main() or server_gae.
	cache cacheInterface

	// TODO: rename this to errNotFound and move to errors.go
	errCacheMiss = errors.New("cache: miss")
)

// cacheIterface unifies different types of caches,
// e.g. memoryCache and appengine/memcache.
type cacheInterface interface {
	// set puts data bytes into the cache under key for the duration of the exp.
	set(c context.Context, key string, data []byte, exp time.Duration) error
	// inc atomically increments the decimal value in the given key by delta
	// and returns the new value. The value must fit in a uint64. Overflow wraps around,
	// and underflow is capped to zero
	inc(c context.Context, key string, delta int64, initialValue uint64) (uint64, error)
	// get gets data from the cache put under key.
	// it returns errCacheMiss if item is not in the cache or expired.
	get(c context.Context, key string) ([]byte, error)
	// deleteMulti removes keys from mecache.
	deleleMulti(c context.Context, keys []string) error
	// flush flushes all items from memcache.
	flush(c context.Context) error
}

// memoryCache is a very simple in-memory cache.
type memoryCache struct {
	sync.Mutex
	items map[string]*cacheItem
}

// newMemoryCache creates a new memoryCache instance.
func newMemoryCache() cacheInterface {
	return &memoryCache{items: make(map[string]*cacheItem)}
}

// cacheItem is a single item of the memoryCache.
type cacheItem struct {
	data []byte
	exp  time.Time
}

func (mc *memoryCache) set(c context.Context, key string, data []byte, exp time.Duration) error {
	mc.Lock()
	defer mc.Unlock()
	mc.items[key] = &cacheItem{data, time.Now().Add(exp)}
	return nil
}

func (mc *memoryCache) inc(c context.Context, key string, delta int64, initialValue uint64) (uint64, error) {
	mc.Lock()
	defer mc.Unlock()
	item, ok := mc.items[key]
	if !ok {
		var z time.Time
		b := make([]byte, binary.Size(initialValue))
		binary.PutUvarint(b, initialValue)
		item = &cacheItem{b, z}
		mc.items[key] = item
	}
	v, n := binary.Uvarint(item.data)
	if n <= 0 {
		return 0, fmt.Errorf("inc: binary.Uvarint error: %d", n)
	}
	switch {
	case delta < 0 && v < uint64(delta):
		v = 0
	case delta < 0:
		v -= uint64(delta)
	case delta > 0:
		v += uint64(delta)
	}
	binary.PutUvarint(item.data, v)
	return v, nil
}

func (mc *memoryCache) get(c context.Context, key string) ([]byte, error) {
	mc.Lock()
	defer mc.Unlock()
	item, ok := mc.items[key]
	if !ok || time.Now().After(item.exp) {
		delete(mc.items, key)
		return nil, errCacheMiss
	}
	return item.data, nil
}

func (mc *memoryCache) deleleMulti(c context.Context, keys []string) error {
	sort.Strings(keys)
	mc.Lock()
	defer mc.Unlock()
	for k := range mc.items {
		i := sort.SearchStrings(keys, k)
		if i < len(keys) && keys[i] == k {
			delete(mc.items, k)
		}
	}
	return nil
}

func (mc *memoryCache) flush(c context.Context) error {
	mc.Lock()
	defer mc.Unlock()
	mc.items = make(map[string]*cacheItem)
	return nil
}
