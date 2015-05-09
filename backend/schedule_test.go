package main

import (
	"reflect"
	"testing"
	"time"
)

func TestSubslice(t *testing.T) {
	table := []struct{ in, items, out []string }{
		{[]string{"a", "b", "c"}, []string{"a", "c"}, []string{"b"}},
		{[]string{"a", "b", "c"}, []string{"a", "c", "b"}, []string{}},
		{[]string{"a", "b", "c"}, []string{"d"}, []string{"a", "b", "c"}},
		{[]string{"b", "c"}, []string{"a", "c"}, []string{"b"}},
		{[]string{"a", "b", "c"}, []string{}, []string{"a", "b", "c"}},
		{[]string{"abc", "def"}, []string{"ab"}, []string{"abc", "def"}},
	}
	for i, test := range table {
		out := subslice(test.in, test.items...)
		if !reflect.DeepEqual(out, test.out) {
			t.Errorf("%d: subslice(%v, %v) = %v; want %v", i, test.in, test.items, out, test.out)
		}
	}
}

func TestUnique(t *testing.T) {
	table := []struct{ in, out []string }{
		{[]string{"a", "b", "c"}, []string{"a", "b", "c"}},
		{[]string{"a", "b", "b", "a", "d"}, []string{"a", "b", "d"}},
		{[]string{"a", "a", "a"}, []string{"a"}},
		{[]string{}, []string{}},
	}
	for i, test := range table {
		out := unique(test.in)
		if !reflect.DeepEqual(out, test.out) {
			t.Errorf("%d: unique(%v) = %v; want %v", i, test.in, out, test.out)
		}
	}
}

func TestDiffEventData(t *testing.T) {
	a := &eventData{
		Sessions: map[string]*eventSession{
			"__keynote__": &eventSession{
				Title:     "Keynote",
				StartTime: time.Date(2015, 5, 28, 9, 30, 0, 0, time.UTC),
				Tags:      []string{"FLAG_KEYNOTE"},
				Filters:   map[string]bool{"Live streamed": true},
			},
		},
	}

	b := &eventData{
		Sessions: map[string]*eventSession{
			"__keynote__": &eventSession{
				Title:     "Keynote",
				StartTime: time.Date(2015, 5, 28, 9, 30, 0, 0, time.UTC),
				Tags:      []string{"FLAG_KEYNOTE"},
				Filters:   map[string]bool{"Live streamed": true},
				Speakers:  []string{},
			},
		},
	}

	dc := diffEventData(a, b)

	if l := len(dc.Sessions); l != 0 {
		t.Errorf("len(dc.Sessions) = %d; want 0", l)
	}
}
