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
