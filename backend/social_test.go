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
