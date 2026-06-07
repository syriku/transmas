package config

import (
	"os"
	"path/filepath"
)

type GlobalConfig struct {
	AppPath string
}

func GetGlobalConfig() GlobalConfig {
	if envPath := os.Getenv("TRANSMAS_APP_PATH"); envPath != "" {
		return GlobalConfig{
			AppPath: envPath,
		}
	}
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

var dbPath string

func init() {
	cfg := GetGlobalConfig()
	dbPath = filepath.Join(cfg.AppPath, "savedata.db")
}

// GetDBPath returns the path to the application database file.
func GetDBPath() string {
	return dbPath
}
