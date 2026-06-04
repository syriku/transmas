package service

import (
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
