package service

import (
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

func TestSystemService_GetModels_NotImplemented(t *testing.T) {
	s := NewSystemService()

	// Test CLAUDE (not implemented)
	config := api.UserConfig{
		Type: api.API_TYPE_CLAUDE,
	}

	_, err := s.GetModels(config)
	if err == nil {
		t.Fatal("expected error for Claude models API not implemented, got nil")
	}

	if !strings.Contains(err.Error(), "models API is not implemented") {
		t.Errorf("expected error message to contain 'models API is not implemented', got: %v", err)
	}
}
