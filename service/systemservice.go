package service

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/syriku/aisdk/request"
	"github.com/syriku/transmas/agents"
	"github.com/syriku/transmas/config"
	"github.com/wailsapp/wails/v3/pkg/application"
)

type SystemService struct {
}

func NewSystemService() *SystemService {
	return &SystemService{}
}

func (s *SystemService) DeleteUserData() error {
	if agents.IsLoggedIn() {
		return fmt.Errorf("cannot delete user data while a user is logged in")
	}

	cfg := config.GetGlobalConfig()
	dbPath := filepath.Join(cfg.AppPath, "prototype", "manga", "savedata.db")

	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		return nil
	}

	return os.Remove(dbPath)
}

func (s *SystemService) SetWorkDir() (string, error) {
	app := application.Get()
	return app.Dialog.
		OpenFile().
		CanChooseFiles(false).
		CanChooseDirectories(true).
		SetTitle("Choose Work Directory").
		PromptForSingleSelection()
}

func (s *SystemService) ListCandidateChapters(dir string) ([]string, error) {
	info, err := os.Stat(dir)
	if err != nil {
		return nil, err
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("%s is not a directory", dir)
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	files := make([]string, 0)
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if filepath.Ext(name) == ".txt" {
			base := strings.TrimSuffix(name, ".txt")
			files = append(files, base)
		}
	}
	return files, nil
}

func (s *SystemService) GetLanguagesMap() map[request.Language]string {
	return request.GetLanguagesMap()
}

func (s *SystemService) GetSystemLanguage() string {
	return getSystemLanguage()
}
