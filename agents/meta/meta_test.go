package meta

import (
	"os"
	"reflect"
	"testing"
	"time"

	"github.com/syriku/quill-delta/quilldelta"
)

func TestConvertIndicesForSizeChange(t *testing.T) {
	// Construct a delta with several paragraph blocks:
	// "Para 1\n\n\nPara 2\n\nPara 3\n\nPara 4\n\nPara 5"
	// Length of blocks:
	// B1: "Para 1\n" (7 runes)
	// B2: "\n\n" (2 runes, blank) -> split boundary
	// B3: "Para 2\n" (7 runes)
	// B4: "\n" (1 rune, blank) -> split boundary
	// B5: "Para 3\n" (7 runes)
	// B6: "\n" (1 rune, blank) -> split boundary
	// B7: "Para 4\n" (7 runes)
	// B8: "\n" (1 rune, blank) -> split boundary
	// B9: "Para 5" (6 runes)
	d := quilldelta.NewDelta()
	d.Insert("Para 1\n\n\nPara 2\n\nPara 3\n\nPara 4\n\nPara 5", nil)

	// Partitioning with Old Size = 8:
	// Chunk 1: B1 + B2 = "Para 1\n\n\n" (9 runes >= 8)
	// Chunk 2: B3 + B4 = "Para 2\n\n" (8 runes >= 8)
	// Chunk 3: B5 + B6 = "Para 3\n\n" (8 runes >= 8)
	// Chunk 4: B7 + B8 = "Para 4\n\n" (8 runes >= 8)
	// Chunk 5: B9 = "Para 5" (6 runes)
	// Runes per chunk: [9, 8, 8, 8, 6]
	// Cumulative old lengths: [9, 17, 25, 33, 39]

	// Partitioning with New Size = 16:
	// Chunk 1: B1 + B2 + B3 + B4 = "Para 1\n\n\nPara 2\n\n" (17 runes >= 16)
	// Chunk 2: B5 + B6 + B7 + B8 = "Para 3\n\nPara 4\n\n" (16 runes >= 16)
	// Chunk 3: B9 = "Para 5" (6 runes)
	// Runes per chunk: [17, 16, 6]
	// Cumulative new lengths: [17, 33, 39]

	tests := []struct {
		name         string
		oldIndices   []int
		oldChunkSize int
		newChunkSize int
		wantIndices  []int
	}{
		{
			name:         "Continuous prefix fully maps to new chunk 1",
			oldIndices:   []int{1, 2}, // total old prefix length = 9 + 8 = 17 runes
			oldChunkSize: 8,
			newChunkSize: 16,
			wantIndices:  []int{1}, // cumulative new chunk 1 is 17 runes <= 17
		},
		{
			name:         "Continuous prefix maps to new chunks 1 and 2",
			oldIndices:   []int{1, 2, 3, 4}, // total old prefix length = 9 + 8 + 8 + 8 = 33 runes
			oldChunkSize: 8,
			newChunkSize: 16,
			wantIndices:  []int{1, 2}, // cumulative new chunk 1+2 is 17 + 16 = 33 runes <= 33
		},
		{
			name:         "Discontinuous prefix (only chunk 3)",
			oldIndices:   []int{3},
			oldChunkSize: 8,
			newChunkSize: 16,
			wantIndices:  []int{}, // 0 prefix because not starting from 1 or discontinuous
		},
		{
			name:         "Partially discontinuous prefix",
			oldIndices:   []int{1, 2, 4}, // continuous prefix is 1, 2
			oldChunkSize: 8,
			newChunkSize: 16,
			wantIndices:  []int{1},
		},
		{
			name:         "Size reduction 16 -> 8",
			oldIndices:   []int{1}, // total old prefix length = 17 runes
			oldChunkSize: 16,
			newChunkSize: 8,
			wantIndices:  []int{1, 2}, // cumulative new chunks 1+2 is 9 + 8 = 17 runes <= 17
		},
		{
			name:         "Empty old indices",
			oldIndices:   []int{},
			oldChunkSize: 8,
			newChunkSize: 16,
			wantIndices:  []int{},
		},
		{
			name:         "All old chunks checked maps to all new chunks checked",
			oldIndices:   []int{1, 2, 3, 4, 5},
			oldChunkSize: 8,
			newChunkSize: 16,
			wantIndices:  []int{1, 2, 3},
		},
		{
			name:         "All old chunks checked maps to all new chunks checked (large new size)",
			oldIndices:   []int{1, 2, 3, 4, 5},
			oldChunkSize: 8,
			newChunkSize: 100,
			wantIndices:  []int{1},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ConvertIndicesForSizeChange(tt.oldIndices, tt.oldChunkSize, tt.newChunkSize, d)
			if !reflect.DeepEqual(got, tt.wantIndices) {
				t.Errorf("ConvertIndicesForSizeChange() = %v, want %v", got, tt.wantIndices)
			}
		})
	}
}

func TestLoadSaveMeta(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "meta_test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	filename := "test_chapter.txt"

	// 1. Load meta for non-existent file
	m, err := LoadMeta(tmpDir, filename)
	if err != nil {
		t.Fatalf("LoadMeta failed: %v", err)
	}
	if m.ChapterTitle != filename {
		t.Errorf("expected ChapterTitle to be %q, got %q", filename, m.ChapterTitle)
	}
	if len(m.TranslatedChunks) != 0 || len(m.ReviewedChunks) != 0 {
		t.Errorf("expected empty slices for new metadata")
	}

	// 2. Save and load back
	m.ProjectName = "TestProject"
	m.ChapterOrder = 1
	m.LastChunkSize = 1000
	m.LastChunkCount = 5
	m.TranslatedChunks = []int{1, 2}
	m.ReviewedChunks = []int{1}

	err = SaveMeta(tmpDir, filename, m)
	if err != nil {
		t.Fatalf("SaveMeta failed: %v", err)
	}

	loaded, err := LoadMeta(tmpDir, filename)
	if err != nil {
		t.Fatalf("LoadMeta failed: %v", err)
	}

	if !reflect.DeepEqual(loaded, m) {
		t.Errorf("loaded meta %+v does not match saved %+v", loaded, m)
	}

	// 3. Test SaveMetaAsync
	m.LastChunkSize = 2000
	SaveMetaAsync(tmpDir, filename, m)

	// wait briefly for write to finish
	time.Sleep(50 * time.Millisecond)

	loadedAsync, err := LoadMeta(tmpDir, filename)
	if err != nil {
		t.Fatalf("LoadMeta failed: %v", err)
	}
	if loadedAsync.LastChunkSize != 2000 {
		t.Errorf("expected LastChunkSize to be 2000, got %d", loadedAsync.LastChunkSize)
	}
}

func TestSetTranslatedAndReviewed(t *testing.T) {
	m := &ChapterMeta{
		TranslatedChunks: []int{1, 2},
		ReviewedChunks:   []int{1},
	}

	// Set chunk 2 (index 1) translated state to true (already true)
	m.SetTranslated(1, true)
	if !reflect.DeepEqual(m.TranslatedChunks, []int{1, 2}) {
		t.Errorf("expected translated chunks to remain [1, 2], got %v", m.TranslatedChunks)
	}

	// Set chunk 3 (index 2) translated state to true (new)
	m.SetTranslated(2, true)
	if !reflect.DeepEqual(m.TranslatedChunks, []int{1, 2, 3}) {
		t.Errorf("expected translated chunks to be [1, 2, 3], got %v", m.TranslatedChunks)
	}

	// Set chunk 2 (index 1) translated state to false
	m.SetTranslated(1, false)
	if !reflect.DeepEqual(m.TranslatedChunks, []int{1, 3}) {
		t.Errorf("expected translated chunks to be [1, 3], got %v", m.TranslatedChunks)
	}

	// Set chunk 2 (index 1) reviewed state to true
	m.SetReviewed(1, true)
	if !reflect.DeepEqual(m.ReviewedChunks, []int{1, 2}) {
		t.Errorf("expected reviewed chunks to be [1, 2], got %v", m.ReviewedChunks)
	}

	// Set chunk 1 (index 0) reviewed state to false
	m.SetReviewed(0, false)
	if !reflect.DeepEqual(m.ReviewedChunks, []int{2}) {
		t.Errorf("expected reviewed chunks to be [2], got %v", m.ReviewedChunks)
	}
}
