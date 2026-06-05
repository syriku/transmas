package service

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/syriku/aisdk/request"
	"github.com/syriku/transmas/agents"
	"github.com/syriku/transmas/config"
	"github.com/syriku/transmas/server"
	"github.com/wailsapp/wails/v3/pkg/application"
)

type SystemService struct {
	router      *server.MasterRouter
	handlerImpl http.Handler
}

func NewSystemService() *SystemService {
	return &SystemService{}
}

// GetAssetHandler initializes the master router with the fallback handler and returns it.
func (s *SystemService) GetAssetHandler(fallback http.Handler) http.Handler {
	s.handlerImpl = fallback
	s.router = server.NewMasterRouter(fallback)
	return s.router
}

// SetWorkspace updates the workspace directory for the routing server.
func (s *SystemService) SetWorkspace(workspace string) error {
	if s.router == nil {
		return fmt.Errorf("router not initialized")
	}
	if workspace != "" {
		info, err := os.Stat(workspace)
		if err != nil {
			return fmt.Errorf("failed to access workspace: %w", err)
		}
		if !info.IsDir() {
			return fmt.Errorf("workspace path is not a directory: %s", workspace)
		}
	}
	s.router.SetWorkspace(workspace)
	return nil
}

// GetWorkspace retrieves the current workspace path.
func (s *SystemService) GetWorkspace() (string, error) {
	if s.router == nil {
		return "", fmt.Errorf("router not initialized")
	}
	return s.router.GetWorkspace(), nil
}

// GetChapterPages lists the image files (.jpg, .jpeg, .png) in the specified chapter folder.
func (s *SystemService) GetChapterPages(chapterName string) ([]string, error) {
	if s.router == nil {
		return nil, fmt.Errorf("router not initialized")
	}
	ws := s.router.GetWorkspace()
	if ws == "" {
		return nil, fmt.Errorf("workspace not set")
	}

	chapterDir := filepath.Join(ws, chapterName)
	info, err := os.Stat(chapterDir)
	if err != nil {
		return nil, fmt.Errorf("failed to access chapter: %w", err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("chapter path is not a directory: %s", chapterName)
	}

	entries, err := os.ReadDir(chapterDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read chapter directory: %w", err)
	}

	var pages []string
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if strings.HasPrefix(name, ".") {
			continue
		}
		ext := strings.ToLower(filepath.Ext(name))
		if ext == ".jpg" || ext == ".jpeg" || ext == ".png" {
			pages = append(pages, name)
		}
	}
	return pages, nil
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

func (s *SystemService) ListCandidateChapters(dir string, isComic bool) ([]string, error) {
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
		name := entry.Name()
		if isComic {
			if entry.IsDir() && !strings.HasPrefix(name, ".") {
				files = append(files, name)
			}
		} else {
			if entry.IsDir() {
				continue
			}
			if filepath.Ext(name) == ".txt" {
				base := strings.TrimSuffix(name, ".txt")
				files = append(files, base)
			}
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
