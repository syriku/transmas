package server

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestServerRoutes(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "transmas-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	mockProjects := []ProjectInfo{
		{Title: "Project Alpha", WorkDir: tempDir},
	}

	config := ServerConfig{
		Port:     45999, // use a test-specific port
		Username: "testuser",
		ListProjects: func() ([]ProjectInfo, error) {
			return mockProjects, nil
		},
		GetProjectWorkDir: func(projectName string) (string, error) {
			if projectName == "Project Alpha" {
				return tempDir, nil
			}
			return "", nil
		},
		GetNextChapterOrder: func(projectName string) (uint, error) {
			return 1, nil
		},
		AddChapter: func(projectName string, order uint, title string) error {
			return nil
		},
	}

	factory := NewClientFactory()
	srv, err := factory.Create(config)
	if err != nil {
		t.Fatalf("failed to create server: %v", err)
	}
	defer srv.Dispose()

	client := &http.Client{}
	baseURL := "http://127.0.0.1:45999"

	// 1. Test GET /user
	resp, err := client.Get(baseURL + "/user")
	if err != nil {
		t.Fatalf("GET /user failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var userResp map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&userResp); err != nil {
		t.Fatalf("failed to decode user response: %v", err)
	}
	if userResp["username"] != "testuser" {
		t.Errorf("expected username 'testuser', got '%s'", userResp["username"])
	}

	// 2. Test GET /projects
	resp, err = client.Get(baseURL + "/projects")
	if err != nil {
		t.Fatalf("GET /projects failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var projectsResp []ProjectInfo
	if err := json.NewDecoder(resp.Body).Decode(&projectsResp); err != nil {
		t.Fatalf("failed to decode projects response: %v", err)
	}
	if len(projectsResp) != 1 || projectsResp[0].Title != "Project Alpha" {
		t.Errorf("unexpected projects response: %+v", projectsResp)
	}

	// 3. Test POST /chapter/html
	htmlContent := `
		<p class="widget-episodeTitle">Test Title</p>
		<p id="p1">First paragraph of the chapter.</p>
		<p id="p2">Second paragraph of the chapter.</p>
	`
	postBody, _ := json.Marshal(map[string]string{
		"projectName": "Project Alpha",
		"html":        htmlContent,
		"title":       "Test Title",
	})

	resp, err = client.Post(baseURL+"/chapter/html", "application/json", bytes.NewBuffer(postBody))
	if err != nil {
		t.Fatalf("POST /chapter/html failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected status 200, got %d. Body: %s", resp.StatusCode, string(body))
	}

	var postHtmlResp map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&postHtmlResp); err != nil {
		t.Fatalf("failed to decode post html response: %v", err)
	}
	if postHtmlResp["status"] != "success" || postHtmlResp["title"] != "Test Title" {
		t.Errorf("unexpected post html response: %+v", postHtmlResp)
	}

	// Verify file was written
	writtenFilePath := filepath.Join(tempDir, "Test Title.txt")
	if _, err := os.Stat(writtenFilePath); os.IsNotExist(err) {
		t.Errorf("expected file %s to be written, but it does not exist", writtenFilePath)
	} else {
		contentBytes, _ := os.ReadFile(writtenFilePath)
		expectedContent := "Test Title\n\n\nFirst paragraph of the chapter.\nSecond paragraph of the chapter."
		if string(contentBytes) != expectedContent {
			t.Errorf("expected file content %q, got %q", expectedContent, string(contentBytes))
		}
	}

	// 4. Test POST /chapter/url using a local mock HTTP server
	mockKakuyomuServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`
			<p class="widget-episodeTitle">Test URL Title</p>
			<p id="p1">Content from URL first.</p>
			<p id="p2">Content from URL second.</p>
		`))
	}))
	defer mockKakuyomuServer.Close()

	postUrlBody, _ := json.Marshal(map[string]string{
		"projectName": "Project Alpha",
		"url":         mockKakuyomuServer.URL,
	})

	resp, err = client.Post(baseURL+"/chapter/url", "application/json", bytes.NewBuffer(postUrlBody))
	if err != nil {
		t.Fatalf("POST /chapter/url failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected status 200, got %d. Body: %s", resp.StatusCode, string(body))
	}

	var postUrlResp map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&postUrlResp); err != nil {
		t.Fatalf("failed to decode post url response: %v", err)
	}
	if postUrlResp["status"] != "success" || postUrlResp["title"] != "Test URL Title" {
		t.Errorf("unexpected post url response: %+v", postUrlResp)
	}

	// Verify file was written
	writtenUrlFilePath := filepath.Join(tempDir, "Test URL Title.txt")
	if _, err := os.Stat(writtenUrlFilePath); os.IsNotExist(err) {
		t.Errorf("expected file %s to be written, but it does not exist", writtenUrlFilePath)
	} else {
		contentBytes, _ := os.ReadFile(writtenUrlFilePath)
		expectedContent := "Test URL Title\n\n\nContent from URL first.\nContent from URL second."
		if string(contentBytes) != expectedContent {
			t.Errorf("expected file content %q, got %q", expectedContent, string(contentBytes))
		}
	}
}
