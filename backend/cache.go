package main

import (
	"errors"
	"sync"
	"time"

	"golang.org/x/net/context"
)

var (
	// cache is the instance used by the program,
	// initialized by the standalone server's main() or server_gae.
	cache cacheInterface

	errCacheMiss = errors.New("cache: miss")
)

// cacheIterface unifies different types of caches,
// e.g. memoryCache and appengine/memcache.
type cacheInterface interface {
	// set puts data bytes into the cache under key for the duration of the exp.
	set(c context.Context, key string, data []byte, exp time.Duration) error
	// get gets data from the cache put under key.
	// it returns errCacheMiss if item is not in the cache or expired.
	get(c context.Context, key string) ([]byte, error)
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

func (mc *memoryCache) flush(c context.Context) error {
	mc.Lock()
	defer mc.Unlock()
	mc.items = make(map[string]*cacheItem)
	return nil
}
