package server

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestMasterRouter(t *testing.T) {
	// Create temporary directory for workspace
	tmpDir, err := os.MkdirTemp("", "transmas_assetserver_test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Create test files:
	// - image1.png
	// - doc1.txt
	err = os.WriteFile(filepath.Join(tmpDir, "image1.png"), []byte("png data"), 0644)
	if err != nil {
		t.Fatalf("failed to write test file: %v", err)
	}
	err = os.WriteFile(filepath.Join(tmpDir, "doc1.txt"), []byte("text data"), 0644)
	if err != nil {
		t.Fatalf("failed to write test file: %v", err)
	}

	fallbackHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("fallback data"))
	})

	router := NewMasterRouter(fallbackHandler)

	// 1. Test fallback without workspace
	req := httptest.NewRequest(http.MethodGet, "/index.html", nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}
	if rr.Body.String() != "fallback data" {
		t.Errorf("expected 'fallback data', got '%s'", rr.Body.String())
	}

	// 2. Test local-manga without workspace configured
	req = httptest.NewRequest(http.MethodGet, "/local-manga/image1.png", nil)
	rr = httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusInternalServerError {
		t.Errorf("expected 500 when workspace not configured, got %d", rr.Code)
	}

	// Configure workspace
	router.SetWorkspace(tmpDir)
	if router.GetWorkspace() != tmpDir {
		t.Errorf("expected workspace %s, got %s", tmpDir, router.GetWorkspace())
	}

	// 3. Test local-manga valid file request
	req = httptest.NewRequest(http.MethodGet, "/local-manga/image1.png", nil)
	rr = httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}
	body, _ := io.ReadAll(rr.Body)
	if string(body) != "png data" {
		t.Errorf("expected 'png data', got '%s'", string(body))
	}

	// 4. Test local-manga invalid extension (not .jpg, .jpeg, .png)
	req = httptest.NewRequest(http.MethodGet, "/local-manga/doc1.txt", nil)
	rr = httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Errorf("expected 403 (Forbidden) for invalid extension, got %d", rr.Code)
	}

	// 5. Test local-manga directory listing / access (no extension)
	req = httptest.NewRequest(http.MethodGet, "/local-manga/", nil)
	rr = httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Errorf("expected 403 (Forbidden) for directory path, got %d", rr.Code)
	}

	// 6. Test fallback is still served normally for non-manga paths
	req = httptest.NewRequest(http.MethodGet, "/other-path", nil)
	rr = httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rr.Code)
	}
	if rr.Body.String() != "fallback data" {
		t.Errorf("expected 'fallback data', got '%s'", rr.Body.String())
	}
}
