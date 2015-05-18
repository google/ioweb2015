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
	"testing"
	"time"

	"golang.org/x/net/context"
)

func TestMemoryCacheHit(t *testing.T) {
	const (
		key  = "test"
		data = "dummy"
	)
	mc := newMemoryCache()
	c := context.Background()

	err := mc.set(c, key, []byte(data), time.Hour)
	if err != nil {
		t.Errorf("mc.set(%q, %q): %v", key, data, err)
	}

	res, err := mc.get(c, key)
	if err != nil {
		t.Fatalf("mc.get(%q): %v", key, err)
	}
	if s := string(res); s != data {
		t.Errorf("mc.get(%q) = %q; want %q", key, s, data)
	}
}

func TestMemoryCacheMiss(t *testing.T) {
	const (
		key  = "test"
		data = "dummy"
	)
	mc := newMemoryCache()
	c := context.Background()

	err := mc.set(c, key, []byte(data), time.Millisecond)
	if err != nil {
		t.Fatalf("mc.set(%q, %q): %v", key, data, err)
	}

	time.Sleep(2 * time.Millisecond)
	res, err := mc.get(c, key)
	if err != errCacheMiss {
		t.Errorf("mc.get(%q) = %q (%v); want errCacheMiss", key, string(res), err)
	}
}

func TestMemoryCacheInc(t *testing.T) {
	mc := newMemoryCache()
	c := context.Background()

	table := []struct {
		delta   int64
		initVal uint64
		res     uint64
	}{
		{3, 1, 4}, {1, 0, 5}, {-5, 0, 0}, {10, 0, 10}, {-100, 0, 0},
	}

	for i, test := range table {
		v, err := mc.inc(c, "test", test.delta, test.initVal)
		if err != nil {
			t.Fatalf("%d: inc(%d, %d)", i, test.delta, test.initVal)
		}
		if v != test.res {
			t.Errorf("%d: inc(%d, %d) = %d; want %d", i, test.delta, test.initVal, v, test.res)
		}
	}
}

func TestMemoryCacheFlush(t *testing.T) {
	mc := newMemoryCache()
	c := context.Background()
	err := mc.set(c, "key", []byte("data"), 1*time.Hour)
	if err != nil {
		t.Fatalf("mc.set: %v", err)
	}
	mc.flush(c)
	_, err = mc.get(c, "key")
	if err != errCacheMiss {
		t.Errorf("mc.get: %v; want errCacheMiss", err)
	}
}
