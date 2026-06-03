package service

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/syriku/aisdk/api"
)

func TestSystemService_GetModels_Unsupported(t *testing.T) {
	s := NewSystemService()

	// Test unsupported type
	config := api.UserConfig{
		Type: 99,
	}

	_, err := s.GetModels(config)
	if err == nil {
		t.Fatal("expected error for unsupported API type, got nil")
	}

	if !strings.Contains(err.Error(), "unsupported API type") {
		t.Errorf("expected error message to contain 'unsupported API type', got: %v", err)
	}
}

func TestSystemService_DeleteUserData(t *testing.T) {
	// Create a temp directory for AppPath
	tmpDir, err := os.MkdirTemp("", "transmas_test_*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)

	t.Setenv("TRANSMAS_APP_PATH", tmpDir)

	s := NewSystemService()

	// 1. Initially, no user is logged in. DeleteUserData should succeed (and do nothing if DB doesn't exist).
	err = s.DeleteUserData()
	if err != nil {
		t.Fatalf("expected nil error when no database exists, got: %v", err)
	}

	dbPath := filepath.Join(tmpDir, "prototype", "manga", "savedata.db")

	// 2. Since we want to test when logged in, let's set up an active agent.
	agentService := NewAgentService()
	err = agentService.LogIn("testuser")
	if err != nil {
		t.Fatalf("failed to log in: %v", err)
	}

	// Now IsLoggedIn() should be true. DeleteUserData should return error.
	err = s.DeleteUserData()
	if err == nil {
		t.Fatal("expected error when user is logged in, got nil")
	}
	if !strings.Contains(err.Error(), "cannot delete user data while a user is logged in") {
		t.Errorf("expected error message to contain login check, got: %v", err)
	}

	// 4. Log out. DeleteUserData should succeed and delete the file.
	err = agentService.LogOut()
	if err != nil {
		t.Fatalf("failed to log out: %v", err)
	}

	err = s.DeleteUserData()
	if err != nil {
		t.Fatalf("expected nil error after logout, got: %v", err)
	}

	// Verify file is gone
	if _, err := os.Stat(dbPath); !os.IsNotExist(err) {
		t.Error("expected database file to be deleted, but it still exists")
	}

	// 5. Verify we can log in again after deletion (recreating the database)
	err = agentService.LogIn("testuser")
	if err != nil {
		t.Fatalf("failed to log in again after deletion: %v", err)
	}

	// Verify database file is recreated
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		t.Error("expected database file to be recreated, but it does not exist")
	}

	// Clean up login
	_ = agentService.LogOut()
}
