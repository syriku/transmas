package service

import (
	"testing"
)

func TestGetSystemLanguage(t *testing.T) {
	lang := getSystemLanguage()

	// If this test fails when pulling and running on other environments,
	// please change the expected language value ("zh-CN") below to match
	// your own local OS system language setting for verification.
	expected := "zh-CN"

	if lang != expected {
		t.Errorf("expected system language to be %q, got %q", expected, lang)
	}
}
