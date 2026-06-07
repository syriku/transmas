package service

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"unicode"
	"unicode/utf8"

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
//
//wails:ignore
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
		if config.IsValidImageExtension(filepath.Ext(name)) {
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

// ListCandidatePages lists candidate image pages in the specified directory.
func (s *SystemService) ListCandidatePages(dir string) ([]string, error) {
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
		if strings.HasPrefix(name, ".") {
			continue
		}
		if config.IsValidImageExtension(filepath.Ext(name)) {
			files = append(files, name)
		}
	}

	sort.Slice(files, func(i, j int) bool {
		return CompareNatural(files[i], files[j]) < 0
	})

	return files, nil
}

// InferLpChapterDir checks if the chosen lp file is inside a direct subdirectory of the project directory.
// If it is, and that subdirectory contains images, it returns the name of the subdirectory.
// Otherwise it returns an empty string.
func (s *SystemService) InferLpChapterDir(projectDir string, lpPath string) (string, error) {
	cleanProjectDir := filepath.Clean(projectDir)
	cleanLpPath := filepath.Clean(lpPath)

	rel, err := filepath.Rel(cleanProjectDir, cleanLpPath)
	if err != nil {
		return "", nil
	}

	if strings.HasPrefix(rel, "..") || rel == "." || rel == "" {
		return "", nil
	}

	parts := strings.Split(filepath.ToSlash(rel), "/")
	if len(parts) < 2 {
		return "", nil
	}

	subDirName := parts[0]
	subDirPath := filepath.Join(cleanProjectDir, subDirName)

	info, err := os.Stat(subDirPath)
	if err != nil || !info.IsDir() {
		return "", nil
	}

	entries, err := os.ReadDir(subDirPath)
	if err != nil {
		return "", nil
	}

	hasImages := false
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if strings.HasPrefix(name, ".") {
			continue
		}
		if config.IsValidImageExtension(filepath.Ext(name)) {
			hasImages = true
			break
		}
	}

	if !hasImages {
		return "", nil
	}

	return subDirName, nil
}

func (s *SystemService) GetLanguagesMap() map[request.Language]string {
	return request.GetLanguagesMap()
}

func (s *SystemService) GetSystemLanguage() string {
	return getSystemLanguage()
}

// SortPagesNatural sorts the given list of pages naturally (alphanumeric sorting).
func (s *SystemService) SortPagesNatural(pages []string) []string {
	result := make([]string, len(pages))
	copy(result, pages)
	sort.Slice(result, func(i, j int) bool {
		return CompareNatural(result[i], result[j]) < 0
	})
	return result
}

// CompareNatural compares two strings naturally (case-insensitive alphanumeric comparison).
func CompareNatural(a, b string) int {
	i, j := 0, 0
	for i < len(a) && j < len(b) {
		r1, size1 := utf8.DecodeRuneInString(a[i:])
		r2, size2 := utf8.DecodeRuneInString(b[j:])

		isDigit1 := r1 >= '0' && r1 <= '9'
		isDigit2 := r2 >= '0' && r2 <= '9'

		if isDigit1 && isDigit2 {
			endI := i
			for endI < len(a) {
				r, sz := utf8.DecodeRuneInString(a[endI:])
				if r < '0' || r > '9' {
					break
				}
				endI += sz
			}
			numStrA := a[i:endI]

			endJ := j
			for endJ < len(b) {
				r, sz := utf8.DecodeRuneInString(b[endJ:])
				if r < '0' || r > '9' {
					break
				}
				endJ += sz
			}
			numStrB := b[j:endJ]

			cleanA := strings.TrimLeft(numStrA, "0")
			cleanB := strings.TrimLeft(numStrB, "0")

			if len(cleanA) != len(cleanB) {
				if len(cleanA) < len(cleanB) {
					return -1
				}
				return 1
			}

			for k := 0; k < len(cleanA); k++ {
				if cleanA[k] != cleanB[k] {
					if cleanA[k] < cleanB[k] {
						return -1
					}
					return 1
				}
			}

			if len(numStrA) != len(numStrB) {
				if len(numStrA) < len(numStrB) {
					return -1
				}
				return 1
			}

			i = endI
			j = endJ
		} else {
			lf1 := unicode.ToLower(r1)
			lf2 := unicode.ToLower(r2)
			if lf1 != lf2 {
				if lf1 < lf2 {
					return -1
				}
				return 1
			}
			i += size1
			j += size2
		}
	}

	if i < len(a) {
		return 1
	}
	if j < len(b) {
		return -1
	}
	return 0
}
