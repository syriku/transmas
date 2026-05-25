//go:build !windows && !darwin

package service

func getSystemLanguage() string {
	return getFallbackLanguage()
}
