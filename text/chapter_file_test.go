package text

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/syriku/quill-delta/quilldelta"
)

func TestChapterFile_IsLargeFile(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "chapter_test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	filePath := filepath.Join(tmpDir, "chapter_large.txt")
	content := "Hello World" // 11 bytes
	if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
		t.Fatalf("failed to write file: %v", err)
	}

	cf := NewChapterFile(tmpDir, "chapter_large.txt", 5)
	large, err := cf.IsLargeFile()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !large {
		t.Errorf("expected file to be large")
	}

	cf = NewChapterFile(tmpDir, "chapter_large.txt", 20)
	large, err = cf.IsLargeFile()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if large {
		t.Errorf("expected file not to be large")
	}
}

func TestPartitionDelta(t *testing.T) {
	// Let's create a delta representing:
	// "Hello\nWorld\n" with "Hello" being bold.
	d := quilldelta.NewDelta()
	d.Insert("Hello", map[string]any{"bold": true})
	d.Insert("\n", nil)
	d.Insert("World\n", nil)

	// Case 1: MaxRuneSize = 0 -> should return the original delta as single chunk
	chunksZero := PartitionDelta(d, 0)
	if len(chunksZero) != 1 {
		t.Fatalf("expected 1 chunk, got %d", len(chunksZero))
	}

	// Case 2: MaxRuneSize = 5 -> since the whole "Hello\nWorld\n" is one natural paragraph (mixed formatting but no empty lines), it shouldn't be split.
	chunks := PartitionDelta(d, 5)
	if len(chunks) != 1 {
		t.Fatalf("expected 1 chunk, got %d", len(chunks))
	}

	// Check chunk 1: should contain all ops, with \n and World\n merged because they both have nil attributes
	c1 := chunks[0]
	if len(c1.Ops) != 2 {
		t.Fatalf("expected chunk 1 to have 2 ops, got %d. Ops: %+v", len(c1.Ops), c1.Ops)
	}
	if !reflect.DeepEqual(c1.Ops[0].Insert, quilldelta.TextInsert("Hello")) {
		t.Errorf("expected op 0 to be 'Hello', got %v", c1.Ops[0].Insert)
	}
	if !reflect.DeepEqual(c1.Ops[1].Insert, quilldelta.TextInsert("\nWorld\n")) {
		t.Errorf("expected op 1 to be '\\nWorld\\n', got %v", c1.Ops[1].Insert)
	}
}

func TestReadChapter(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "chapter_test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Case 1: Load from .txt file (NewFromText)
	title := "chapter_read.txt"
	filePath := filepath.Join(tmpDir, title)
	content := "Para 1\n\n\nPara 2\n\nPara 3"
	if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
		t.Fatalf("failed to write file: %v", err)
	}

	// MaxChunkRuneSize = 8.
	// Parsed natural paragraphs:
	// 1. "Para 1\n" (7 runes)
	// 2. "\n\n" (2 runes)
	// 3. "Para 2\n" (7 runes)
	// 4. "\n" (1 rune)
	// 5. "Para 3\n" (7 runes)
	// Chunks will be partitioned:
	// Chunk 1: "Para 1\n", "\n\n" (7+2 = 9 runes >= 8)
	// Chunk 2: "Para 2\n", "\n" (7+1 = 8 runes >= 8)
	// Chunk 3: "Para 3\n" (7 runes)
	cf, chunks, err := ReadChapter(tmpDir, title, 8)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cf == nil {
		t.Fatal("expected cf to not be nil")
	}
	if len(chunks) != 3 {
		t.Fatalf("expected 3 chunks, got %d", len(chunks))
	}

	// Case 2: Load from .json file (NewFromFile)
	// Create "chapter_read.json"
	d := quilldelta.NewDelta()
	d.Insert("JSON Chapter", map[string]any{"bold": true})
	d.Insert("\n", nil)

	jsonData, err := json.Marshal(d)
	if err != nil {
		t.Fatalf("failed to marshal delta: %v", err)
	}
	jsonPath := filepath.Join(tmpDir, "chapter_read.json")
	if err := os.WriteFile(jsonPath, jsonData, 0644); err != nil {
		t.Fatalf("failed to write json file: %v", err)
	}

	// Loading "chapter_read.txt" when "chapter_read.json" exists
	cfJSON, chunksJSON, err := ReadChapter(tmpDir, title, 100)
	if err != nil {
		t.Fatalf("unexpected error reading from json: %v", err)
	}
	if !cfJSON.jsonExists() {
		t.Errorf("expected jsonExists to be true")
	}
	if len(chunksJSON) != 1 {
		t.Fatalf("expected 1 chunk from json, got %d", len(chunksJSON))
	}
	// Verify that the content was loaded from the JSON file
	ops := chunksJSON[0].Ops
	if len(ops) != 2 {
		t.Fatalf("expected 2 ops, got %d", len(ops))
	}
	if !reflect.DeepEqual(ops[0].Insert, quilldelta.TextInsert("JSON Chapter")) {
		t.Errorf("expected loaded text from JSON file, got %v", ops[0].Insert)
	}
}

func TestPartitionDelta_BoundaryLogic(t *testing.T) {
	// "Para 1\n\n\nPara 2\n\nPara 3"
	// Block 1: "Para 1\n" (7 runes, text)
	// Block 2: "\n\n" (2 runes, empty)
	// Block 3: "Para 2\n" (7 runes, text)
	// Block 4: "\n" (1 rune, empty)
	// Block 5: "Para 3\n" (7 runes, text)
	d := quilldelta.NewDelta()
	d.Insert("Para 1\n\n\nPara 2\n\nPara 3", nil)

	// If MaxChunkRuneSize = 5:
	// - Block 1 ("Para 1\n", length 7) is text and >= 5, but we should not split because it's not a blank paragraph.
	// - Block 2 ("\n\n", length 2) is blank, so we should split after Block 2.
	// Chunk 1 should contain: "Para 1\n\n\n" (9 runes)
	// Chunk 2 should contain: "Para 2\n\n" (8 runes)
	// Chunk 3 should contain: "Para 3" (6 runes)
	chunks := PartitionDelta(d, 5)
	if len(chunks) != 3 {
		t.Fatalf("expected 3 chunks, got %d", len(chunks))
	}

	// Verify the contents of chunks
	c1Str := getDeltaText(chunks[0])
	if c1Str != "Para 1\n\n\n" {
		t.Errorf("expected chunk 1 to be 'Para 1\\n\\n\\n', got %q", c1Str)
	}

	c2Str := getDeltaText(chunks[1])
	if c2Str != "Para 2\n\n" {
		t.Errorf("expected chunk 2 to be 'Para 2\\n\\n', got %q", c2Str)
	}

	c3Str := getDeltaText(chunks[2])
	if c3Str != "Para 3" {
		t.Errorf("expected chunk 3 to be 'Para 3', got %q", c3Str)
	}
}

// Helper to extract plain text from delta
func getDeltaText(d *quilldelta.Delta) string {
	var sb strings.Builder
	for _, op := range d.Ops {
		if insert, ok := op.Insert.(quilldelta.TextInsert); ok {
			sb.WriteString(string(insert))
		}
	}
	return sb.String()
}
