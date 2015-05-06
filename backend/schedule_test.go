package main

import (
	"reflect"
	"testing"
)

func TestSubslice(t *testing.T) {
	table := []struct{ in, items, out []string }{
		{[]string{"a", "b", "c"}, []string{"a", "c"}, []string{"b"}},
		{[]string{"a", "b", "c"}, []string{"a", "c", "b"}, []string{}},
		{[]string{"a", "b", "c"}, []string{"d"}, []string{"a", "b", "c"}},
		{[]string{"b", "c"}, []string{"a", "c"}, []string{"b"}},
		{[]string{"a", "b", "c"}, []string{}, []string{"a", "b", "c"}},
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
