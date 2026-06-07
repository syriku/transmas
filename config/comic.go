package config

import (
	"strings"
)

// Supported image extensions.
const (
	ExtJPG  = ".jpg"
	ExtJPEG = ".jpeg"
	ExtPNG  = ".png"
)

// IsValidImageExtension returns true if the extension (including the dot) is a supported image type (case-insensitive).
func IsValidImageExtension(ext string) bool {
	lower := strings.ToLower(ext)
	return lower == ExtJPG || lower == ExtJPEG || lower == ExtPNG
}
