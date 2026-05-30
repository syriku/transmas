package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sync"
	"time"

	"github.com/syriku/kakuyomu-loader"
)

// TransmasClient defines the interface for the server instance.
type TransmasClient interface {
	Dispose() error
}

// ProjectInfo represents the project data returned to the Chrome extension.
type ProjectInfo struct {
	Title   string `json:"title"`
	WorkDir string `json:"workDir"`
}

// ServerConfig defines configuration options and callbacks for the server.
type ServerConfig struct {
	Port                int
	Username            string
	ListProjects        func() ([]ProjectInfo, error)
	GetProjectWorkDir   func(projectName string) (string, error)
	GetNextChapterOrder func(projectName string) (uint, error)
	AddChapter          func(projectName string, order uint, title string) error
}

// ClientFactory is the factory to build the TransmasClient.
type ClientFactory struct{}

// NewClientFactory creates a new ClientFactory.
func NewClientFactory() *ClientFactory {
	return &ClientFactory{}
}

// serverImpl implements TransmasClient.
type serverImpl struct {
	server *http.Server
	ln     net.Listener
	wg     sync.WaitGroup
}

// Dispose cleanly shuts down the HTTP server.
func (s *serverImpl) Dispose() error {
	if s.server == nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := s.server.Shutdown(ctx)
	s.wg.Wait()
	return err
}

var invalidFilenameChars = regexp.MustCompile(`[\\/:*?"<>|]`)

// Create creates a new server instance, starts it in a background goroutine, and returns it.
func (f *ClientFactory) Create(config ServerConfig) (TransmasClient, error) {
	if config.Port <= 0 {
		config.Port = 45123
	}

	mux := http.NewServeMux()

	// CORS helper
	enableCORS := func(w http.ResponseWriter, r *http.Request) bool {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return true
		}
		return false
	}

	writeJSONError := func(w http.ResponseWriter, statusCode int, message string) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(statusCode)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
	}

	// GET /user
	mux.HandleFunc("/user", func(w http.ResponseWriter, r *http.Request) {
		if enableCORS(w, r) {
			return
		}
		if r.Method != http.MethodGet {
			writeJSONError(w, http.StatusMethodNotAllowed, "Method not allowed")
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"username": config.Username})
	})

	// GET /projects
	mux.HandleFunc("/projects", func(w http.ResponseWriter, r *http.Request) {
		if enableCORS(w, r) {
			return
		}
		if r.Method != http.MethodGet {
			writeJSONError(w, http.StatusMethodNotAllowed, "Method not allowed")
			return
		}

		if config.ListProjects == nil {
			writeJSONError(w, http.StatusInternalServerError, "ListProjects callback not configured")
			return
		}

		projects, err := config.ListProjects()
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(projects)
	})

	// Helper function to create chapter from loader.Novel
	createChapter := func(projectName string, novel *loader.Novel) error {
		if novel.Title == "" {
			return errors.New("novel title is empty")
		}

		workDir, err := config.GetProjectWorkDir(projectName)
		if err != nil {
			return fmt.Errorf("failed to get project work directory: %w", err)
		}
		if workDir == "" {
			return fmt.Errorf("project work directory is not set")
		}

		sanitizedTitle := invalidFilenameChars.ReplaceAllString(novel.Title, "_")
		if sanitizedTitle == "" {
			sanitizedTitle = "untitled"
		}

		filePath := filepath.Join(workDir, sanitizedTitle+".txt")
		content := fmt.Sprintf("%s\n\n\n%s", novel.Title, novel.Content)

		err = os.WriteFile(filePath, []byte(content), 0644)
		if err != nil {
			return fmt.Errorf("failed to write novel file: %w", err)
		}

		nextOrder, err := config.GetNextChapterOrder(projectName)
		if err != nil {
			return fmt.Errorf("failed to calculate next chapter order: %w", err)
		}

		err = config.AddChapter(projectName, nextOrder, sanitizedTitle)
		if err != nil {
			return fmt.Errorf("failed to add chapter to project: %w", err)
		}

		return nil
	}

	// POST /chapter/html
	mux.HandleFunc("/chapter/html", func(w http.ResponseWriter, r *http.Request) {
		if enableCORS(w, r) {
			return
		}
		if r.Method != http.MethodPost {
			writeJSONError(w, http.StatusMethodNotAllowed, "Method not allowed")
			return
		}

		var req struct {
			ProjectName string `json:"projectName"`
			HTML        string `json:"html"`
		}

		err := json.NewDecoder(r.Body).Decode(&req)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, "Invalid request body")
			return
		}

		if req.ProjectName == "" {
			writeJSONError(w, http.StatusBadRequest, "projectName is required")
			return
		}
		if req.HTML == "" {
			writeJSONError(w, http.StatusBadRequest, "html content is required")
			return
		}

		reader := loader.NewHtmlReader(req.HTML)
		novel, err := reader.Novel()
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to parse HTML: %v", err))
			return
		}

		err = createChapter(req.ProjectName, novel)
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "success", "title": novel.Title})
	})

	// POST /chapter/url
	mux.HandleFunc("/chapter/url", func(w http.ResponseWriter, r *http.Request) {
		if enableCORS(w, r) {
			return
		}
		if r.Method != http.MethodPost {
			writeJSONError(w, http.StatusMethodNotAllowed, "Method not allowed")
			return
		}

		var req struct {
			ProjectName string `json:"projectName"`
			URL         string `json:"url"`
		}

		err := json.NewDecoder(r.Body).Decode(&req)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, "Invalid request body")
			return
		}

		if req.ProjectName == "" {
			writeJSONError(w, http.StatusBadRequest, "projectName is required")
			return
		}
		if req.URL == "" {
			writeJSONError(w, http.StatusBadRequest, "url is required")
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()

		l := loader.NewKakuyomuLoader()
		novel, err := l.Load(ctx, req.URL)
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to fetch or parse URL: %v", err))
			return
		}

		err = createChapter(req.ProjectName, novel)
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "success", "title": novel.Title})
	})

	// Create listener
	addr := fmt.Sprintf("127.0.0.1:%d", config.Port)
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		// Try localhost if 127.0.0.1 fails
		addr = fmt.Sprintf("localhost:%d", config.Port)
		ln, err = net.Listen("tcp", addr)
		if err != nil {
			return nil, fmt.Errorf("failed to listen on port %d: %w", config.Port, err)
		}
	}

	server := &http.Server{
		Handler: mux,
	}

	s := &serverImpl{
		server: server,
		ln:     ln,
	}

	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		if err := server.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
			// In case of unexpected server stop, we can print it or handle it
		}
	}()

	return s, nil
}
