package main

import (
	"errors"

	"golang.org/x/net/context"
)

func userSchedule(c context.Context) ([]string, error) {
	return nil, errors.New("not implemented")
}

func bookmarkSession(c context.Context, id string) error {
	return errors.New("not implemented")
}

func unbookmarkSession(c context.Context, id string) error {
	return errors.New("not implemented")
}
