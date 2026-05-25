package meta

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/syriku/quill-delta/quilldelta"
	"github.com/syriku/transmas/text"
)

type ChapterStatus int

const (
	StatusUncompleted ChapterStatus = iota
	StatusTranslated
	StatusReviewed
)

type ChapterMeta struct {
	ProjectName      string `json:"projectName"`
	ChapterOrder     uint   `json:"chapterOrder"`
	ChapterTitle     string `json:"chapterTitle"`
	LastChunkSize    int    `json:"lastChunkSize"`
	LastChunkCount   int    `json:"lastChunkCount"`
	TranslatedChunks []int  `json:"translatedChunks"` // 1-based indices
	ReviewedChunks   []int  `json:"reviewedChunks"`   // 1-based indices
}

// MetaFilePath returns the path to the hidden meta file next to the chapter file.
func MetaFilePath(workDir, filename string) string {
	ext := filepath.Ext(filename)
	base := strings.TrimSuffix(filename, ext)
	hiddenName := fmt.Sprintf(".%s.meta.json", base)
	return filepath.Join(workDir, hiddenName)
}

// LoadMeta loads the ChapterMeta from the hidden file next to the chapter file.
// If the file does not exist, it returns a new empty ChapterMeta and nil error.
func LoadMeta(workDir, filename string) (*ChapterMeta, error) {
	path := MetaFilePath(workDir, filename)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return &ChapterMeta{
				ChapterTitle:     filename,
				TranslatedChunks: []int{},
				ReviewedChunks:   []int{},
			}, nil
		}
		return nil, err
	}

	var m ChapterMeta
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, err
	}
	return &m, nil
}

// SaveMeta saves the ChapterMeta to the hidden file.
func SaveMeta(workDir, filename string, m *ChapterMeta) error {
	path := MetaFilePath(workDir, filename)
	data, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

// SaveMetaAsync saves the ChapterMeta in the background thread-safely.
func SaveMetaAsync(workDir, filename string, m *ChapterMeta) {
	data, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		log.Printf("Failed to marshal chapter meta for async saving: %v", err)
		return
	}
	path := MetaFilePath(workDir, filename)
	go func(data []byte) {
		if err := os.WriteFile(path, data, 0644); err != nil {
			log.Printf("Failed to save chapter meta asynchronously for %s: %v", filename, err)
		}
	}(data)
}

// ConvertIndicesForSizeChange converts continuous index prefix of checked/translated chunks
// from the old layout to the new layout based on cumulative character counts.
func ConvertIndicesForSizeChange(
	oldIndices []int,
	oldChunkSize int,
	newChunkSize int,
	fullDelta *quilldelta.Delta,
) []int {
	if len(oldIndices) == 0 || oldChunkSize <= 0 || newChunkSize <= 0 || fullDelta == nil {
		return []int{}
	}

	// 1. Get continuous prefix length starting from 1
	set := make(map[int]bool)
	for _, idx := range oldIndices {
		set[idx] = true
	}
	k := 0
	for {
		if set[k+1] {
			k++
		} else {
			break
		}
	}

	if k == 0 {
		return []int{}
	}

	// 2. Partition fullDelta with oldChunkSize
	oldChunks := text.PartitionDelta(fullDelta, oldChunkSize)
	if k > len(oldChunks) {
		k = len(oldChunks)
	}

	// 3. Calculate sum of rune lengths of the first k old chunks
	totalRuneLength := 0
	for i := 0; i < k; i++ {
		totalRuneLength += getDeltaRuneLength(oldChunks[i])
	}

	// 4. Partition fullDelta with newChunkSize
	newChunks := text.PartitionDelta(fullDelta, newChunkSize)

	// If all old chunks are checked, all new chunks are checked.
	if k == len(oldChunks) {
		newIndices := make([]int, len(newChunks))
		for j := range newChunks {
			newIndices[j] = j + 1
		}
		return newIndices
	}

	// 5. Find new chunks fully covered by totalRuneLength
	var newIndices []int
	cumulativeNewLength := 0
	for j, newChunk := range newChunks {
		chunkLen := getDeltaRuneLength(newChunk)
		if cumulativeNewLength+chunkLen <= totalRuneLength {
			newIndices = append(newIndices, j+1)
			cumulativeNewLength += chunkLen
		} else {
			break
		}
	}

	return newIndices
}

func getDeltaRuneLength(d *quilldelta.Delta) int {
	if d == nil {
		return 0
	}
	length := 0
	for _, op := range d.Ops {
		switch insert := op.Insert.(type) {
		case quilldelta.TextInsert:
			length += len([]rune(string(insert)))
		case quilldelta.ObjectInsert:
			length += 1
		}
	}
	return length
}

func (m *ChapterMeta) SetTranslated(chunkIndex int, completed bool) {
	ordinal := chunkIndex + 1
	m.TranslatedChunks = updateIndices(m.TranslatedChunks, ordinal, completed)
}

func (m *ChapterMeta) SetReviewed(chunkIndex int, completed bool) {
	ordinal := chunkIndex + 1
	m.ReviewedChunks = updateIndices(m.ReviewedChunks, ordinal, completed)
}

func updateIndices(slice []int, val int, add bool) []int {
	found := slices.Contains(slice, val)
	if add && !found {
		return append(slice, val)
	}
	if !add && found {
		var res []int
		for _, x := range slice {
			if x != val {
				res = append(res, x)
			}
		}
		return res
	}
	return slice
}

func (m *ChapterMeta) GetStatus(totalChunks int) ChapterStatus {
	if totalChunks <= 0 {
		return StatusUncompleted
	}

	// Check if all chunks are reviewed
	allReviewed := true
	for i := 1; i <= totalChunks; i++ {
		if !slices.Contains(m.ReviewedChunks, i) {
			allReviewed = false
			break
		}
	}
	if allReviewed {
		return StatusReviewed
	}

	// Check if all chunks are translated
	allTranslated := true
	for i := 1; i <= totalChunks; i++ {
		if !slices.Contains(m.TranslatedChunks, i) {
			allTranslated = false
			break
		}
	}
	if allTranslated {
		return StatusTranslated
	}

	return StatusUncompleted
}
