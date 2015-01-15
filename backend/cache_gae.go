// +build appengine

package main

import (
	"time"

	"golang.org/x/net/context"

	"appengine/memcache"
)

// cacheInterface implementation using appengine/memcache.
type gaeMemcache struct{}

func (mc *gaeMemcache) set(c context.Context, key string, data []byte, exp time.Duration) error {
	ac := appengineContext(c)
	item := &memcache.Item{
		Key:        key,
		Value:      data,
		Expiration: exp,
	}
	return memcache.Set(ac, item)
}

func (mc *gaeMemcache) get(c context.Context, key string) ([]byte, error) {
	ac := appengineContext(c)
	item, err := memcache.Get(ac, key)
	if err == memcache.ErrCacheMiss {
		return nil, errCacheMiss
	} else if err != nil {
		return nil, err
	}
	return item.Value, nil
}
