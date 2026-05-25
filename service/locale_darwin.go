package service

import (
	"os/exec"
	"strings"
)

func getSystemLanguage() string {
	cmd := exec.Command("defaults", "read", "-g", "AppleLocale")
	if output, err := cmd.Output(); err == nil {
		locale := strings.TrimSpace(string(output))
		if locale != "" {
			return strings.ReplaceAll(locale, "_", "-")
		}
	}

	// Fallback to AppleLanguages preference array
	cmd = exec.Command("defaults", "read", "-g", "AppleLanguages")
	if output, err := cmd.Output(); err == nil {
		str := string(output)
		firstQuote := strings.Index(str, "\"")
		if firstQuote != -1 {
			secondQuote := strings.Index(str[firstQuote+1:], "\"")
			if secondQuote != -1 {
				return str[firstQuote+1 : firstQuote+1+secondQuote]
			}
		}
	}

	return getFallbackLanguage()
}
