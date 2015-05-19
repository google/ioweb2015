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

import "testing"

func TestIncludesWord(t *testing.T) {
	filter := "#io15"
	table := []struct {
		in  string
		out bool
	}{
		{"#io15 leading", true},
		{"in the #io15 middle", true},
		{"in the end #io15", true},
		{"multiple #io15 hash #io15 tags", true},
		{"The #io15extended map already features 200+ Extended events in 70 countries! #io15", true},
		{"many #io15many different #io15hash tags #io15", true},
		{"some #other tag", false},
		{"no tags at all", false},
		{"", false},
	}

	for i, test := range table {
		if v := includesWord(test.in, filter); v != test.out {
			t.Errorf("%d: includesWord(%q, %q) = %v; want %v", i, test.in, filter, v, test.out)
		}
	}
}
