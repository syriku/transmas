package service

import (
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestSystemService_ListCandidateChapters(t *testing.T) {
	// Create temporary directory
	tmpDir, err := os.MkdirTemp("", "transmas_service_test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Create test files/directories:
	// - chap1.txt
	// - chap2.txt
	// - Chapter_Folder (dir)
	// - .hidden_dir (dir starting with dot)
	// - normal_file.md

	err = os.WriteFile(filepath.Join(tmpDir, "chap1.txt"), []byte("content"), 0644)
	if err != nil {
		t.Fatalf("failed to write test file: %v", err)
	}
	err = os.WriteFile(filepath.Join(tmpDir, "chap2.txt"), []byte("content"), 0644)
	if err != nil {
		t.Fatalf("failed to write test file: %v", err)
	}
	err = os.WriteFile(filepath.Join(tmpDir, "normal_file.md"), []byte("content"), 0644)
	if err != nil {
		t.Fatalf("failed to write test file: %v", err)
	}
	err = os.MkdirAll(filepath.Join(tmpDir, "Chapter_Folder"), 0755)
	if err != nil {
		t.Fatalf("failed to create directory: %v", err)
	}
	err = os.MkdirAll(filepath.Join(tmpDir, ".hidden_dir"), 0755)
	if err != nil {
		t.Fatalf("failed to create directory: %v", err)
	}

	ss := NewSystemService()

	// 1. Test as Novel Project (isComic = false)
	candidates, err := ss.ListCandidateChapters(tmpDir, false)
	if err != nil {
		t.Fatalf("failed to list candidate chapters: %v", err)
	}

	expectedNovel := []string{"chap1", "chap2"}
	// Order in os.ReadDir is alphabetical, so it should match
	if !reflect.DeepEqual(candidates, expectedNovel) {
		t.Errorf("expected novel candidates %v, got %v", expectedNovel, candidates)
	}

	// 2. Test as Comic Project (isComic = true)
	candidates, err = ss.ListCandidateChapters(tmpDir, true)
	if err != nil {
		t.Fatalf("failed to list candidate chapters: %v", err)
	}

	expectedComic := []string{"Chapter_Folder"}
	if !reflect.DeepEqual(candidates, expectedComic) {
		t.Errorf("expected comic candidates %v, got %v", expectedComic, candidates)
	}
}

func TestSystemService_Workspace(t *testing.T) {
	// Create temporary directory for workspace
	tmpDir, err := os.MkdirTemp("", "transmas_workspace_test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Create a chapter folder with files
	chapterName := "chapter_01"
	chapterDir := filepath.Join(tmpDir, chapterName)
	err = os.MkdirAll(chapterDir, 0755)
	if err != nil {
		t.Fatalf("failed to create chapter dir: %v", err)
	}

	// Create test files:
	// - page1.png (valid)
	// - page2.jpg (valid)
	// - page3.JPEG (valid - case insensitivity check)
	// - page4.webp (invalid)
	// - doc.txt (invalid)
	validFiles := []string{"page1.png", "page2.jpg", "page3.JPEG"}
	invalidFiles := []string{"page4.webp", "doc.txt"}

	for _, name := range validFiles {
		err = os.WriteFile(filepath.Join(chapterDir, name), []byte("image data"), 0644)
		if err != nil {
			t.Fatalf("failed to write file: %v", err)
		}
	}
	for _, name := range invalidFiles {
		err = os.WriteFile(filepath.Join(chapterDir, name), []byte("other data"), 0644)
		if err != nil {
			t.Fatalf("failed to write file: %v", err)
		}
	}

	ss := NewSystemService()

	// 1. Set/Get workspace before router is initialized should return error
	_, err = ss.GetWorkspace()
	if err == nil {
		t.Error("expected error getting workspace from uninitialized router")
	}

	err = ss.SetWorkspace(tmpDir)
	if err == nil {
		t.Error("expected error setting workspace on uninitialized router")
	}

	// 2. Initialize asset handler
	handler := ss.GetAssetHandler(http.NotFoundHandler())
	if handler == nil {
		t.Fatal("expected non-nil asset handler")
	}

	// 3. Set workspace
	err = ss.SetWorkspace(tmpDir)
	if err != nil {
		t.Fatalf("failed to set workspace: %v", err)
	}

	ws, err := ss.GetWorkspace()
	if err != nil {
		t.Fatalf("failed to get workspace: %v", err)
	}
	if ws != tmpDir {
		t.Errorf("expected workspace %s, got %s", tmpDir, ws)
	}

	// 4. List chapter pages
	pages, err := ss.GetChapterPages(chapterName)
	if err != nil {
		t.Fatalf("failed to get chapter pages: %v", err)
	}

	expectedPages := []string{"page1.png", "page2.jpg", "page3.JPEG"}
	if !reflect.DeepEqual(pages, expectedPages) {
		t.Errorf("expected pages %v, got %v", expectedPages, pages)
	}

	// 5. Try to set workspace to non-existent directory
	err = ss.SetWorkspace("/nonexistent/path/here")
	if err == nil {
		t.Error("expected error setting workspace to non-existent directory")
	}
}

func TestSystemService_ListCandidatePages(t *testing.T) {
	// Create temporary directory
	tmpDir, err := os.MkdirTemp("", "transmas_pages_test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Create test files:
	// - page1.png (valid)
	// - page2.JPG (valid)
	// - page3.jpeg (valid)
	// - doc.txt (invalid)
	// - Subdir (dir, invalid)
	// - .hidden.png (hidden, invalid)
	err = os.WriteFile(filepath.Join(tmpDir, "page1.png"), []byte("png"), 0644)
	if err != nil {
		t.Fatalf("failed to write file: %v", err)
	}
	err = os.WriteFile(filepath.Join(tmpDir, "page2.JPG"), []byte("jpg"), 0644)
	if err != nil {
		t.Fatalf("failed to write file: %v", err)
	}
	err = os.WriteFile(filepath.Join(tmpDir, "page3.jpeg"), []byte("jpeg"), 0644)
	if err != nil {
		t.Fatalf("failed to write file: %v", err)
	}
	err = os.WriteFile(filepath.Join(tmpDir, "doc.txt"), []byte("text"), 0644)
	if err != nil {
		t.Fatalf("failed to write file: %v", err)
	}
	err = os.WriteFile(filepath.Join(tmpDir, ".hidden.png"), []byte("hidden"), 0644)
	if err != nil {
		t.Fatalf("failed to write file: %v", err)
	}
	err = os.Mkdir(filepath.Join(tmpDir, "Subdir"), 0755)
	if err != nil {
		t.Fatalf("failed to create dir: %v", err)
	}

	ss := NewSystemService()
	pages, err := ss.ListCandidatePages(tmpDir)
	if err != nil {
		t.Fatalf("failed to list candidate pages: %v", err)
	}

	expected := []string{"page1.png", "page2.JPG", "page3.jpeg"}
	if !reflect.DeepEqual(pages, expected) {
		t.Errorf("expected candidate pages %v, got %v", expected, pages)
	}
}

func TestSystemService_SortPagesNatural(t *testing.T) {
	ss := NewSystemService()
	input := []string{"page10.png", "page2.png", "page1.png", "page02.png", "page002.png"}
	expected := []string{"page1.png", "page2.png", "page02.png", "page002.png", "page10.png"}
	output := ss.SortPagesNatural(input)
	if !reflect.DeepEqual(output, expected) {
		t.Errorf("expected sorted pages %v, got %v", expected, output)
	}
}
