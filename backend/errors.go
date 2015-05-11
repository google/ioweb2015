package main

import (
	"errors"
	"fmt"
	"time"
)

var (
	errAuthInvalid   = errors.New("mismatched or malformed authorization")
	errAuthMissing   = errors.New("authorization required")
	errAuthTokenType = errors.New("invalid token type")
	errConflict      = errors.New("precondition or data conflict")
	errNotFound      = errors.New("data not found")
	errNotModified   = errors.New("content not modified")
)

// pushError is used in methods that communicate with Push services like GCM.
//  - msg: error message
//  - retry: whether the caller should retry
//  - after: try again after this duration, unless retry == false
//  - remove: the caller should remove the subscription ID. Implies retry == false.
type pushError struct {
	msg    string
	retry  bool
	remove bool
	after  time.Duration
}

func (pe *pushError) Error() string {
	return pe.msg
}

func (pe *pushError) String() string {
	return fmt.Sprintf("<pushError: retry=%v; remove=%v; after=%v; %s>",
		pe.retry, pe.remove, pe.after, pe.msg)
}

// apiError is an error used by API handlers
type apiError struct {
	err  error
	code int
	msg  string
}

func (ae *apiError) Error() string {
	return ae.msg
}

// prefixedErr returns a func that creates errors with the given prefix.
func prefixedErr(prefix string) func(interface{}) error {
	return func(err interface{}) error {
		return fmt.Errorf("%s: %v", prefix, err)
	}
}
