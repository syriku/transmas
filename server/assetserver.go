package server

import (
	"net/http"
	"path"
	"strings"
	"sync"

	"github.com/syriku/transmas/config"
)

// MasterRouter is a custom asset router that handles serving local manga files
// under the "/local-manga" prefix and falls back to a default handler for other assets.
type MasterRouter struct {
	mu         sync.RWMutex
	workspace  string
	fallback   http.Handler
	fileServer http.Handler
}

// NewMasterRouter creates a new MasterRouter with the given fallback handler.
func NewMasterRouter(fallback http.Handler) *MasterRouter {
	return &MasterRouter{
		fallback: fallback,
	}
}

// SetWorkspace updates the workspace directory and dynamically updates the file server.
func (r *MasterRouter) SetWorkspace(workspace string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.workspace = workspace
	if workspace != "" {
		r.fileServer = http.StripPrefix("/local-manga", http.FileServer(http.Dir(workspace)))
	} else {
		r.fileServer = nil
	}
}

// GetWorkspace returns the current workspace directory.
func (r *MasterRouter) GetWorkspace() string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.workspace
}

// ServeHTTP implements http.Handler, routing local manga requests and falling back to default assets.
func (r *MasterRouter) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	if req.URL.Path == "/local-manga" || strings.HasPrefix(req.URL.Path, "/local-manga/") {
		// Only allow serving valid image files
		if !config.IsValidImageExtension(path.Ext(req.URL.Path)) {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		r.mu.RLock()
		fs := r.fileServer
		r.mu.RUnlock()

		if fs != nil {
			fs.ServeHTTP(w, req)
			return
		}
		http.Error(w, "Workspace not configured", http.StatusInternalServerError)
		return
	}

	if r.fallback != nil {
		r.fallback.ServeHTTP(w, req)
		return
	}

	http.NotFound(w, req)
}
