package agents

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/syriku/aisdk/api"
	"github.com/syriku/aisdk/request"
	"github.com/syriku/quill-delta/quilldelta"
	"github.com/syriku/transmas/agents/database"
	"github.com/syriku/transmas/agents/meta"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestTranslateAgentImpl_ReadChapterAndPageTurning(t *testing.T) {
	// 1. Setup temporary directory for workspace/chapter files
	tmpDir, err := os.MkdirTemp("", "transmas_agent_test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Create test content: Para 1 (998 'A's), Para 2 (600 'B's)
	// Since MaxChunkRuneSize is hardcoded to 1000 in agent.go, these two paragraphs
	// cannot fit in a single chunk (998 + 600 = 1598 > 1000).
	// So they will form two chunks.
	para1Text := strings.Repeat("A", 998)
	para2Text := strings.Repeat("B", 600)
	content := para1Text + "\n\n\n" + para2Text
	chapterFilename := "chap1.txt"
	if err := os.WriteFile(filepath.Join(tmpDir, chapterFilename), []byte(content), 0644); err != nil {
		t.Fatalf("failed to write test chapter file: %v", err)
	}

	// 2. Setup in-memory SQLite DB and run migrations
	db, err := gorm.Open(sqlite.Open("file:memdb_read?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open memory db: %v", err)
	}
	err = db.AutoMigrate(&database.UserData{}, &database.ProjectInfo{}, &database.Chapter{})
	if err != nil {
		t.Fatalf("failed to migrate db: %v", err)
	}

	// 3. Create test user, project, and chapter in DB
	username := "testuser"
	projectName := "testproject"

	agent, err := NewTranslateAgent(db, username)
	if err != nil {
		t.Fatalf("failed to create translate agent: %v", err)
	}

	err = agent.AddProject(projectName, database.ProjectTypeNovel)
	if err != nil {
		t.Fatalf("failed to add project: %v", err)
	}

	err = agent.UpdateProjectDir(projectName, tmpDir)
	if err != nil {
		t.Fatalf("failed to update project workdir: %v", err)
	}

	err = agent.AddChapter(projectName, 1, "chap1")
	if err != nil {
		t.Fatalf("failed to add chapter: %v", err)
	}

	// 4. Test page turning operations BEFORE loading chapter (should return error)
	_, err = agent.NextChunk()
	if err == nil {
		t.Errorf("expected error calling NextChunk before loading chapter, got nil")
	}
	_, err = agent.PrevChunk()
	if err == nil {
		t.Errorf("expected error calling PrevChunk before loading chapter, got nil")
	}

	// 5. Read Chapter (should return first chunk)
	firstChunk, err := agent.ReadChapter(projectName, 1, false)
	if err != nil {
		t.Fatalf("unexpected error reading chapter: %v", err)
	}

	// First chunk should contain Para 1 and the consecutive newlines, but not Para 2.
	if firstChunk.Current != 1 {
		t.Errorf("expected current chunk to be 1, got %d", firstChunk.Current)
	}
	if firstChunk.Total != 2 {
		t.Errorf("expected total chunks to be 2, got %d", firstChunk.Total)
	}
	if len(firstChunk.Delta.Ops) != 2 {
		t.Fatalf("expected first chunk to have 2 ops, got %d", len(firstChunk.Delta.Ops))
	}
	if !reflect.DeepEqual(firstChunk.Delta.Ops[0].Insert, quilldelta.TextInsert(para1Text+"\n")) {
		t.Errorf("unexpected paragraph 1 content")
	}
	if !reflect.DeepEqual(firstChunk.Delta.Ops[1].Insert, quilldelta.TextInsert("\n\n")) {
		t.Errorf("unexpected empty paragraph content: %v", firstChunk.Delta.Ops[1].Insert)
	}

	// 6. Turn to next page (should return second chunk)
	secondChunk, err := agent.NextChunk()
	if err != nil {
		t.Fatalf("unexpected error calling NextChunk: %v", err)
	}
	if secondChunk.Current != 2 {
		t.Errorf("expected current chunk to be 2, got %d", secondChunk.Current)
	}
	if secondChunk.Total != 2 {
		t.Errorf("expected total chunks to be 2, got %d", secondChunk.Total)
	}
	if len(secondChunk.Delta.Ops) != 1 {
		t.Fatalf("expected second chunk to have 1 op, got %d", len(secondChunk.Delta.Ops))
	}
	if !reflect.DeepEqual(secondChunk.Delta.Ops[0].Insert, quilldelta.TextInsert(para2Text+"\n")) {
		t.Errorf("unexpected paragraph 2 content")
	}

	// 7. Try NextChunk again (should error since it's the last page)
	_, err = agent.NextChunk()
	if err == nil {
		t.Errorf("expected error calling NextChunk on last chunk, got nil")
	}

	// 8. Turn to previous page (should return first chunk again)
	prevChunk, err := agent.PrevChunk()
	if err != nil {
		t.Fatalf("unexpected error calling PrevChunk: %v", err)
	}
	if prevChunk.Current != 1 {
		t.Errorf("expected current chunk to be 1, got %d", prevChunk.Current)
	}
	if prevChunk.Total != 2 {
		t.Errorf("expected total chunks to be 2, got %d", prevChunk.Total)
	}
	if len(prevChunk.Delta.Ops) != 2 {
		t.Fatalf("expected prev chunk to have 2 ops, got %d", len(prevChunk.Delta.Ops))
	}

	// 9. Try PrevChunk again (should error since it's the first page)
	_, err = agent.PrevChunk()
	if err == nil {
		t.Errorf("expected error calling PrevChunk on first chunk, got nil")
	}
}

func TestTranslateAgentImpl_SaveChapter(t *testing.T) {
	// 1. Setup temporary directory for workspace/chapter files
	tmpDir, err := os.MkdirTemp("", "transmas_agent_save_test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	content := "Line 1\nLine 2"
	chapterFilename := "chap1.txt"
	if err := os.WriteFile(filepath.Join(tmpDir, chapterFilename), []byte(content), 0644); err != nil {
		t.Fatalf("failed to write test chapter file: %v", err)
	}

	// 2. Setup in-memory SQLite DB and run migrations
	db, err := gorm.Open(sqlite.Open("file:memdb_save?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open memory db: %v", err)
	}
	err = db.AutoMigrate(&database.UserData{}, &database.ProjectInfo{}, &database.Chapter{})
	if err != nil {
		t.Fatalf("failed to migrate db: %v", err)
	}

	username := "testuser"
	projectName := "testproject"

	agent, err := NewTranslateAgent(db, username)
	if err != nil {
		t.Fatalf("failed to create translate agent: %v", err)
	}

	err = agent.AddProject(projectName, database.ProjectTypeNovel)
	if err != nil {
		t.Fatalf("failed to add project: %v", err)
	}

	err = agent.UpdateProjectDir(projectName, tmpDir)
	if err != nil {
		t.Fatalf("failed to update project workdir: %v", err)
	}

	err = agent.AddChapter(projectName, 1, "chap1")
	if err != nil {
		t.Fatalf("failed to add chapter: %v", err)
	}

	// 3. Read chapter to initialize file fields
	info, err := agent.ReadChapter(projectName, 1, false)
	if err != nil {
		t.Fatalf("unexpected error reading chapter: %v", err)
	}
	if info.Dirty {
		t.Errorf("expected newly read chapter to not be dirty, got true")
	}

	// 4. Update original chunk and translated chunk
	newOriginalDelta := quilldelta.NewDelta().Insert("Modified Line 1\nLine 2", nil)
	err = agent.UpdateOriginalChunk(newOriginalDelta)
	if err != nil {
		t.Fatalf("failed to update original chunk: %v", err)
	}

	newTranslatedDelta := quilldelta.NewDelta().Insert("Translated Line 1\nLine 2", nil)
	err = agent.UpdateTranslatedChunk(newTranslatedDelta)
	if err != nil {
		t.Fatalf("failed to update translated chunk: %v", err)
	}

	// Verify that they are now dirty
	infoAfterUpdate, err := agent.ReadChapter(projectName, 1, false)
	if err != nil {
		t.Fatalf("failed to read chapter: %v", err)
	}
	if !infoAfterUpdate.Dirty {
		t.Errorf("expected dirty to be true after updates")
	}

	// 5. Call SaveChapter
	err = agent.SaveChapter()
	if err != nil {
		t.Fatalf("failed to save chapter: %v", err)
	}

	// 6. Verify that files were written correctly
	originalJSONPath := filepath.Join(tmpDir, "chap1.json")
	translatedJSONPath := filepath.Join(tmpDir, "chap1_translated.json")

	if _, err := os.Stat(originalJSONPath); os.IsNotExist(err) {
		t.Errorf("expected original JSON file to exist at %s, but it doesn't", originalJSONPath)
	}

	if _, err := os.Stat(translatedJSONPath); os.IsNotExist(err) {
		t.Errorf("expected translated JSON file to exist at %s, but it doesn't", translatedJSONPath)
	}

	// Verify that dirty is now false
	infoAfterSave, err := agent.ReadChapter(projectName, 1, false)
	if err != nil {
		t.Fatalf("failed to read chapter: %v", err)
	}
	if infoAfterSave.Dirty {
		t.Errorf("expected dirty to be false after SaveChapter")
	}

	// Create a new agent to verify that the saved content is correctly loaded from files (not just cached in memory)
	newAgent, err := NewTranslateAgent(db, username)
	if err != nil {
		t.Fatalf("failed to create new translate agent: %v", err)
	}

	loadedInfo, err := newAgent.ReadChapter(projectName, 1, false)
	if err != nil {
		t.Fatalf("failed to read chapter with new agent: %v", err)
	}

	if loadedInfo.Dirty {
		t.Errorf("expected loaded chapter to not be dirty")
	}

	// Verify original delta matches modified
	if len(loadedInfo.Delta.Ops) != 1 {
		t.Fatalf("expected loaded delta to have 1 op, got %d", len(loadedInfo.Delta.Ops))
	}
	if !reflect.DeepEqual(loadedInfo.Delta.Ops[0].Insert, quilldelta.TextInsert("Modified Line 1\nLine 2")) {
		t.Errorf("expected original delta content to match modified, got %v", loadedInfo.Delta.Ops[0].Insert)
	}

	// Verify translated delta matches translated
	if loadedInfo.TranslatedDelta == nil {
		t.Fatalf("expected loaded translated delta to not be nil")
	}
	if len(loadedInfo.TranslatedDelta.Ops) != 1 {
		t.Fatalf("expected loaded translated delta to have 1 op, got %d", len(loadedInfo.TranslatedDelta.Ops))
	}
	if !reflect.DeepEqual(loadedInfo.TranslatedDelta.Ops[0].Insert, quilldelta.TextInsert("Translated Line 1\nLine 2")) {
		t.Errorf("expected translated delta content to match, got %v", loadedInfo.TranslatedDelta.Ops[0].Insert)
	}
}

func TestTranslateAgentImpl_HandlesAndTranslation(t *testing.T) {
	// 1. Start a mock server representing OpenAI API
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/models") {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"data":[{"id":"mock-model"}]}`))
			return
		}
		// Return a mock chat completions event stream
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		w.Write([]byte("data: {\"choices\":[{\"delta\":{\"content\":\"Translated \"}}]}\n\n"))
		w.Write([]byte("data: {\"choices\":[{\"delta\":{\"content\":\"Chunk\"}}]}\n\n"))
		w.Write([]byte("data: [DONE]\n\n"))
	}))
	defer server.Close()

	// 2. Setup temporary directory for chapter files
	tmpDir, err := os.MkdirTemp("", "transmas_agent_translate_test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// MaxChunkRuneSize is set to 1000 in agent.go.
	// Sync threshold is 0.5 of max size, which is 500 runes.
	// Small chunk: 100 runes. Large chunk: 600 runes.
	contentSync := strings.Repeat("A", 100)
	if err := os.WriteFile(filepath.Join(tmpDir, "chap1.txt"), []byte(contentSync), 0644); err != nil {
		t.Fatalf("failed to write test chapter file: %v", err)
	}

	// 3. Setup in-memory SQLite DB
	db, err := gorm.Open(sqlite.Open("file:memdb_trans?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open memory db: %v", err)
	}
	err = db.AutoMigrate(&database.UserData{}, &database.ProjectInfo{}, &database.Chapter{})
	if err != nil {
		t.Fatalf("failed to migrate db: %v", err)
	}

	username := "testuser"
	projectName := "testproject"

	agent, err := NewTranslateAgent(db, username)
	if err != nil {
		t.Fatalf("failed to create translate agent: %v", err)
	}

	err = agent.AddProject(projectName, database.ProjectTypeNovel)
	if err != nil {
		t.Fatalf("failed to add project: %v", err)
	}

	err = agent.UpdateProjectDir(projectName, tmpDir)
	if err != nil {
		t.Fatalf("failed to update project workdir: %v", err)
	}

	err = agent.AddChapter(projectName, 1, "chap1")
	if err != nil {
		t.Fatalf("failed to add chapter: %v", err)
	}

	// Update AI configs and translators in database
	aiConfigs := map[string]api.UserConfig{
		"myconfig": api.NewUserConfig(server.URL, api.API_TYPE_OPEN_AI, "dummy-key"),
	}
	err = agent.UpdateAiConfig(aiConfigs)
	if err != nil {
		t.Fatalf("failed to update AI configs: %v", err)
	}

	translators := map[string]request.Translator{
		"mytranslator": {
			SourceLang:  request.LAN_JP,
			TargetLang:  request.LAN_ZH_CN,
			StylePrompt: "Modern light novel style",
		},
	}
	err = agent.UpdateTranslators(translators)
	if err != nil {
		t.Fatalf("failed to update translators: %v", err)
	}

	err = agent.UpdateProjectAiConfigKey(projectName, "myconfig")
	if err != nil {
		t.Fatalf("failed to update project AI config key: %v", err)
	}

	err = agent.UpdateProjectTranslatorKey(projectName, "mytranslator")
	if err != nil {
		t.Fatalf("failed to update project translator key: %v", err)
	}

	// Read chapter
	_, err = agent.ReadChapter(projectName, 1, true)
	if err != nil {
		t.Fatalf("failed to read chapter: %v", err)
	}

	// Translate small chunk (Sync)
	respSync, err := agent.TranslateWithParams(projectName, "mock-model", false)
	if err != nil {
		t.Fatalf("sync translation failed: %v", err)
	}
	if respSync.Async {
		t.Errorf("expected synchronous translation, got async")
	}
	if strings.TrimSpace(respSync.Translated) != "Translated Chunk" {
		t.Errorf("expected 'Translated Chunk', got '%s'", respSync.Translated)
	}

	// Verify that the translated chunk is saved in agent
	chunkInfo, err := agent.ReadChapter(projectName, 1, false)
	if err != nil {
		t.Fatalf("failed to read chapter: %v", err)
	}
	translatedText := getDeltaText(chunkInfo.TranslatedDelta)
	if strings.TrimSpace(translatedText) != "Translated Chunk" {
		t.Errorf("expected translated chunk to be 'Translated Chunk', got '%s'", translatedText)
	}

	// Handle creation & destruction
	handle, err := agent.CreateReusableTranslator(projectName, "mock-model")
	if err != nil {
		t.Fatalf("failed to create reusable translator handle: %v", err)
	}
	if handle == 0 {
		t.Errorf("expected non-zero handle")
	}

	// Translate using handle (Sync because chunk is still small)
	respHandle, err := agent.TranslateWithHandle(handle, false)
	if err != nil {
		t.Fatalf("handle translation failed: %v", err)
	}
	if respHandle.Async {
		t.Errorf("expected synchronous translation using handle, got async")
	}
	if strings.TrimSpace(respHandle.Translated) != "Translated Chunk" {
		t.Errorf("expected 'Translated Chunk' from handle, got '%s'", respHandle.Translated)
	}

	err = agent.DestroyReusableTranslator(handle)
	if err != nil {
		t.Fatalf("failed to destroy handle: %v", err)
	}

	// Add chapter 2 for the async path to bypass cache
	err = agent.AddChapter(projectName, 2, "chap2")
	if err != nil {
		t.Fatalf("failed to add chapter 2: %v", err)
	}

	// Chapter 2: 600 'B's (async test)
	contentAsync := strings.Repeat("B", 600)
	if err := os.WriteFile(filepath.Join(tmpDir, "chap2.txt"), []byte(contentAsync), 0644); err != nil {
		t.Fatalf("failed to write test chapter file: %v", err)
	}

	_, err = agent.ReadChapter(projectName, 2, true)
	if err != nil {
		t.Fatalf("failed to read chapter: %v", err)
	}

	// Translate large chunk (Async)
	respAsync, err := agent.TranslateWithParams(projectName, "mock-model", false)
	if err != nil {
		t.Fatalf("async translation failed: %v", err)
	}
	if !respAsync.Async {
		t.Errorf("expected async translation, got sync")
	}

	// Wait a bit for the background goroutine to complete
	time.Sleep(100 * time.Millisecond)

	// Verify that the translated chunk is eventually saved in agent
	chunkInfoAsync, err := agent.ReadChapter(projectName, 2, false)
	if err != nil {
		t.Fatalf("failed to read chapter: %v", err)
	}
	translatedTextAsync := getDeltaText(chunkInfoAsync.TranslatedDelta)
	if strings.TrimSpace(translatedTextAsync) != "Translated Chunk" {
		t.Errorf("expected translated chunk to eventually be 'Translated Chunk', got '%s'", translatedTextAsync)
	}
}

func TestTranslateAgentImpl_ReviewedContextLogic(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/models") {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"data":[{"id":"mock-model"}]}`))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"choices":[{"message":{"content":"Mocked response"}}]}完成`))
	}))
	defer server.Close()

	tmpDir, err := os.MkdirTemp("", "transmas_context_test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Create test chapter with 3 paragraphs > 1000 runes to split into 3 chunks
	para1 := strings.Repeat("A", 1100) + "\n\n"
	para2 := strings.Repeat("B", 1100) + "\n\n"
	para3 := strings.Repeat("C", 1100)
	content := para1 + para2 + para3
	if err := os.WriteFile(filepath.Join(tmpDir, "chap1.txt"), []byte(content), 0644); err != nil {
		t.Fatalf("failed to write test file: %v", err)
	}

	db, err := gorm.Open(sqlite.Open("file:memdb_ctx?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open memory db: %v", err)
	}
	err = db.AutoMigrate(&database.UserData{}, &database.ProjectInfo{}, &database.Chapter{})
	if err != nil {
		t.Fatalf("failed to migrate db: %v", err)
	}

	username := "testuser"
	projectName := "testproject"

	agent, err := NewTranslateAgent(db, username)
	if err != nil {
		t.Fatalf("failed to create agent: %v", err)
	}

	_ = agent.AddProject(projectName, database.ProjectTypeNovel)
	_ = agent.UpdateProjectDir(projectName, tmpDir)
	_ = agent.AddChapter(projectName, 1, "chap1")

	aiConfigs := map[string]api.UserConfig{
		"myconfig": api.NewUserConfig(server.URL, api.API_TYPE_OPEN_AI, "dummy-key"),
	}
	_ = agent.UpdateAiConfig(aiConfigs)
	translators := map[string]request.Translator{
		"mytranslator": {SourceLang: request.LAN_JP, TargetLang: request.LAN_ZH_CN},
	}
	_ = agent.UpdateTranslators(translators)
	_ = agent.UpdateProjectAiConfigKey(projectName, "myconfig")
	_ = agent.UpdateProjectTranslatorKey(projectName, "mytranslator")

	// Read chapter.
	_, err = agent.ReadChapter(projectName, 1, true)
	if err != nil {
		t.Fatalf("failed to read chapter: %v", err)
	}

	// Active chunk is Chunk 1 (index 0). Middle is Chunk 2 (index 1), End is Chunk 3 (index 2).
	// Call Translate in detailed mode on Chunk 1. Since only 1 adjacent exists but it's not reviewed, it should fail.
	_, err = agent.TranslateWithParams(projectName, "mock-model", true)
	if err == nil || !strings.Contains(err.Error(), "adjacent chunk (next) must be reviewed") {
		t.Errorf("expected error for adjacent chunk next reviewed check in detailed mode, got: %v", err)
	}

	// Move to Chunk 2 (index 1)
	_, _ = agent.NextChunk()

	// Call Translate in detailed mode on Chunk 2. Middle chunk needs both adjacent reviewed.
	_, err = agent.TranslateWithParams(projectName, "mock-model", true)
	if err == nil || !strings.Contains(err.Error(), "both adjacent chunks") {
		t.Errorf("expected error for middle chunk detailed mode check, got: %v", err)
	}

	// Move to Chunk 3 (index 2) and mark reviewed
	_, _ = agent.NextChunk()
	err = agent.SetCurrentChunkReviewed(true)
	if err != nil {
		t.Fatalf("SetCurrentChunkReviewed failed: %v", err)
	}

	// Move back to Chunk 2 (index 1). Now next (index 2) is reviewed, prev (index 0) is not reviewed.
	_, _ = agent.PrevChunk()

	// Call Translate in non-detailed mode on Chunk 2. It should fallback to next because prev is not reviewed.
	// Since next is reviewed, it should succeed.
	_, err = agent.TranslateWithParams(projectName, "mock-model", false)
	if err != nil {
		t.Errorf("expected non-detailed translation to succeed using next fallback, got error: %v", err)
	}

	// Call Translate in detailed mode on Chunk 2. Middle chunk needs both adjacent reviewed. Should still fail.
	_, err = agent.TranslateWithParams(projectName, "mock-model", true)
	if err == nil || !strings.Contains(err.Error(), "both adjacent chunks") {
		t.Errorf("expected error for middle chunk detailed mode check with only one reviewed, got: %v", err)
	}

	// Move to Chunk 1 (index 0) and mark reviewed
	_, _ = agent.PrevChunk()
	_ = agent.SetCurrentChunkReviewed(true)

	// Move back to Chunk 2 (index 1). Now both chunk 1 and chunk 3 are reviewed.
	_, _ = agent.NextChunk()

	// Detailed mode translation should now succeed because both adjacents are reviewed.
	_, err = agent.TranslateWithParams(projectName, "mock-model", true)
	if err != nil {
		t.Errorf("expected detailed mode translation to succeed when both adjacents are reviewed, got error: %v", err)
	}
}

func TestTranslateAgentImpl_GetChapterStatus(t *testing.T) {
	// 1. Setup temporary directory for workspace/chapter files
	tmpDir, err := os.MkdirTemp("", "transmas_agent_status_test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	content := "Line 1\nLine 2"
	chapterFilename := "chap1.txt"
	if err := os.WriteFile(filepath.Join(tmpDir, chapterFilename), []byte(content), 0644); err != nil {
		t.Fatalf("failed to write test chapter file: %v", err)
	}

	// 2. Setup in-memory SQLite DB
	db, err := gorm.Open(sqlite.Open("file:memdb_status?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open memory db: %v", err)
	}
	err = db.AutoMigrate(&database.UserData{}, &database.ProjectInfo{}, &database.Chapter{})
	if err != nil {
		t.Fatalf("failed to migrate db: %v", err)
	}

	username := "testuser"
	projectName := "testproject"

	agent, err := NewTranslateAgent(db, username)
	if err != nil {
		t.Fatalf("failed to create translate agent: %v", err)
	}

	err = agent.AddProject(projectName, database.ProjectTypeNovel)
	if err != nil {
		t.Fatalf("failed to add project: %v", err)
	}

	err = agent.UpdateProjectDir(projectName, tmpDir)
	if err != nil {
		t.Fatalf("failed to update project workdir: %v", err)
	}

	err = agent.AddChapter(projectName, 1, "chap1")
	if err != nil {
		t.Fatalf("failed to add chapter: %v", err)
	}

	// Initial status on disk (uncached)
	status, err := agent.GetChapterStatus(projectName, 1)
	if err != nil {
		t.Fatalf("failed to get chapter status: %v", err)
	}
	if status != meta.StatusUncompleted {
		t.Errorf("expected status to be StatusUncompleted, got %v", status)
	}

	// Load chapter (now cached)
	_, err = agent.ReadChapter(projectName, 1, false)
	if err != nil {
		t.Fatalf("failed to read chapter: %v", err)
	}

	// Set chunk 1 translated
	err = agent.SetCurrentChunkTranslated(true)
	if err != nil {
		t.Fatalf("failed to set chunk translated: %v", err)
	}

	// wait briefly for async write to finish
	time.Sleep(100 * time.Millisecond)

	// Get cached status
	status, err = agent.GetChapterStatus(projectName, 1)
	if err != nil {
		t.Fatalf("failed to get chapter status: %v", err)
	}
	if status != meta.StatusTranslated {
		t.Errorf("expected status to be StatusTranslated, got %v", status)
	}

	// Set chunk 1 reviewed
	err = agent.SetCurrentChunkReviewed(true)
	if err != nil {
		t.Fatalf("failed to set chunk reviewed: %v", err)
	}

	// Get cached status
	status, err = agent.GetChapterStatus(projectName, 1)
	if err != nil {
		t.Fatalf("failed to get chapter status: %v", err)
	}
	if status != meta.StatusReviewed {
		t.Errorf("expected status to be StatusReviewed, got %v", status)
	}

	// wait briefly for async write to finish
	time.Sleep(100 * time.Millisecond)

	// Now create a new agent (no cache for this chapter)
	newAgent, err := NewTranslateAgent(db, username)
	if err != nil {
		t.Fatalf("failed to create new agent: %v", err)
	}

	// Read chapter status from disk
	status, err = newAgent.GetChapterStatus(projectName, 1)
	if err != nil {
		t.Fatalf("failed to get chapter status: %v", err)
	}
	if status != meta.StatusReviewed {
		t.Errorf("expected status to be StatusReviewed from disk, got %v", status)
	}
}

func TestTranslateAgentImpl_DeleteProjectAndChapter(t *testing.T) {
	// Setup in-memory SQLite DB
	db, err := gorm.Open(sqlite.Open("file:memdb_delete?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open memory db: %v", err)
	}
	err = db.AutoMigrate(&database.UserData{}, &database.ProjectInfo{}, &database.Chapter{})
	if err != nil {
		t.Fatalf("failed to migrate db: %v", err)
	}

	username := "testuser"
	projectName := "testproject"

	agent, err := NewTranslateAgent(db, username)
	if err != nil {
		t.Fatalf("failed to create translate agent: %v", err)
	}

	// Add project
	err = agent.AddProject(projectName, database.ProjectTypeNovel)
	if err != nil {
		t.Fatalf("failed to add project: %v", err)
	}

	// Add chapter
	err = agent.AddChapter(projectName, 1, "chap1")
	if err != nil {
		t.Fatalf("failed to add chapter: %v", err)
	}

	// Add another chapter
	err = agent.AddChapter(projectName, 2, "chap2")
	if err != nil {
		t.Fatalf("failed to add chapter: %v", err)
	}

	// Verify they are created
	projects, err := agent.ListProjects()
	if err != nil || len(projects) != 1 {
		t.Fatalf("expected 1 project, got: %v (err: %v)", projects, err)
	}

	chapters, err := agent.ListChapters(projectName)
	if err != nil || len(chapters) != 2 {
		t.Fatalf("expected 2 chapters, got: %v (err: %v)", chapters, err)
	}

	// Delete chapter 2
	err = agent.DeleteChapter(projectName, 2)
	if err != nil {
		t.Fatalf("failed to delete chapter: %v", err)
	}

	// Verify chapter 2 is gone but chapter 1 remains
	chapters, err = agent.ListChapters(projectName)
	if err != nil {
		t.Fatalf("failed to list chapters: %v", err)
	}
	if len(chapters) != 1 || chapters[0].Order != 1 {
		t.Errorf("expected only chapter 1 to remain, got: %v", chapters)
	}

	// Verify we can re-create chapter 2 without unique constraint conflict
	err = agent.AddChapter(projectName, 2, "chap2_new")
	if err != nil {
		t.Errorf("failed to recreate chapter after deletion: %v", err)
	}

	// Store project ID to check cascading deletion of chapters directly in DB
	var proj database.ProjectInfo
	err = db.Where(&database.ProjectInfo{Owner: username, Title: projectName}).First(&proj).Error
	if err != nil {
		t.Fatalf("failed to find project directly in db: %v", err)
	}

	// Delete project
	err = agent.DeleteProject(projectName)
	if err != nil {
		t.Fatalf("failed to delete project: %v", err)
	}

	// Verify project is gone
	projects, err = agent.ListProjects()
	if err != nil {
		t.Fatalf("failed to list projects: %v", err)
	}
	if len(projects) != 0 {
		t.Errorf("expected project to be deleted, but still got: %v", projects)
	}

	// Verify chapters under that project ID are hard deleted from the database
	var remainingChapters []database.Chapter
	err = db.Unscoped().Where(&database.Chapter{Project: proj.ID}).Find(&remainingChapters).Error
	if err != nil {
		t.Fatalf("failed to query chapters directly: %v", err)
	}
	if len(remainingChapters) != 0 {
		t.Errorf("expected all chapters of deleted project to be hard-deleted, but found: %v", remainingChapters)
	}

	// Verify we can re-create project without unique constraint conflict
	err = agent.AddProject(projectName, database.ProjectTypeNovel)
	if err != nil {
		t.Errorf("failed to recreate project after deletion: %v", err)
	}
}

func TestTranslateAgentImpl_ComicProject(t *testing.T) {
	// 1. Setup temporary directory for workspace
	tmpDir, err := os.MkdirTemp("", "transmas_comic_agent_test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Create a subdirectory inside tmpDir to act as a chapter candidate
	chapDirName := "Chapter_1"
	err = os.MkdirAll(filepath.Join(tmpDir, chapDirName), 0755)
	if err != nil {
		t.Fatalf("failed to create chap dir: %v", err)
	}

	// 2. Setup in-memory SQLite DB
	db, err := gorm.Open(sqlite.Open("file:memdb_comic?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open memory db: %v", err)
	}
	err = db.AutoMigrate(&database.UserData{}, &database.ProjectInfo{}, &database.Chapter{})
	if err != nil {
		t.Fatalf("failed to migrate db: %v", err)
	}

	username := "testuser"
	projectName := "testcomicproject"

	agent, err := NewTranslateAgent(db, username)
	if err != nil {
		t.Fatalf("failed to create translate agent: %v", err)
	}

	// 3. Add project (Comic type)
	err = agent.AddProject(projectName, database.ProjectTypeComic)
	if err != nil {
		t.Fatalf("failed to add project: %v", err)
	}

	// 4. Set directory
	err = agent.UpdateProjectDir(projectName, tmpDir)
	if err != nil {
		t.Fatalf("failed to update project workdir: %v", err)
	}

	// Verify that the comic_project database file exists
	dbFile := filepath.Join(tmpDir, "comic_project")
	if _, err := os.Stat(dbFile); os.IsNotExist(err) {
		t.Fatalf("expected comic_project database file to exist, but it does not")
	}

	// 5. Add chapter (Comic)
	err = agent.AddChapter(projectName, 1, chapDirName)
	if err != nil {
		t.Fatalf("failed to add chapter: %v", err)
	}

	// 6. List chapters
	chapters, err := agent.ListChapters(projectName)
	if err != nil {
		t.Fatalf("failed to list chapters: %v", err)
	}
	if len(chapters) != 1 {
		t.Fatalf("expected 1 chapter, got %d", len(chapters))
	}
	if chapters[0].Title != chapDirName || chapters[0].Order != 1 {
		t.Errorf("unexpected chapter details: %+v", chapters[0])
	}

	// 7. Get chapter status
	status, err := agent.GetChapterStatus(projectName, 1)
	if err != nil {
		t.Fatalf("failed to get status: %v", err)
	}
	if status != meta.StatusUncompleted {
		t.Errorf("expected StatusUncompleted, got %v", status)
	}

	// 8. Update chapter title
	newTitle := "Chapter 1 - The Beginning"
	err = agent.UpdateChapterTitle(projectName, 1, newTitle)
	if err != nil {
		t.Fatalf("failed to update chapter title: %v", err)
	}

	chapters, err = agent.ListChapters(projectName)
	if err != nil {
		t.Fatalf("failed to list chapters: %v", err)
	}
	if len(chapters) != 1 || chapters[0].Title != newTitle {
		t.Errorf("expected chapter title to be updated to %q, got %+v", newTitle, chapters)
	}

	// 9. Delete chapter
	err = agent.DeleteChapter(projectName, 1)
	if err != nil {
		t.Fatalf("failed to delete chapter: %v", err)
	}

	chapters, err = agent.ListChapters(projectName)
	if err != nil {
		t.Fatalf("failed to list chapters: %v", err)
	}
	if len(chapters) != 0 {
		t.Errorf("expected chapters to be empty after deletion, got %+v", chapters)
	}

	// 10. Delete project
	err = agent.DeleteProject(projectName)
	if err != nil {
		t.Fatalf("failed to delete project: %v", err)
	}
}
