package config

import (
	"os"
	"path/filepath"
)

type GlobalConfig struct {
	AppPath string
}

func GetGlobalConfig() GlobalConfig {
	configDir, err := os.UserConfigDir()
	if err != nil {
		// Fallback to current directory if user config dir cannot be determined
		configDir = "."
	}
	appPath := filepath.Join(configDir, "transmas")
	return GlobalConfig{
		AppPath: appPath,
	}
}
