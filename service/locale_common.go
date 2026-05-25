package service

import (
	"os"
	"strings"
)

func getFallbackLanguage() string {
	if lang := os.Getenv("LANG"); lang != "" {
		parts := strings.Split(lang, ".")
		if len(parts) > 0 && parts[0] != "" {
			return strings.ReplaceAll(parts[0], "_", "-")
		}
	}
	return "en"
}
