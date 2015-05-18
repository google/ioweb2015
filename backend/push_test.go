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
)

func TestSWToken(t *testing.T) {
	u1, t1 := "user-123", time.Now().AddDate(0, 0, -1)
	token, err := encodeSWToken(u1, t1)
	if err != nil {
		t.Fatalf("encodeSWToken(%q, %s): %v", u1, t1, err)
	}

	u2, t2, err := decodeSWToken(token)
	if err != nil {
		t.Fatalf("decodeSWToken(%q): %v", token, err)
	}
	if u2 != u1 {
		t.Errorf("u2 = %q; want %q", u2, u1)
	}
	if t2.Unix() != t1.Unix() {
		t.Errorf("t2 = %s; want %s", t2, t1)
	}
}
