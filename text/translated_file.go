package text

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/syriku/quill-delta/quilldelta"
)

// TranslatedFile represents a translated chapter file, sharing the same structure as ChapterFile.
type TranslatedFile ChapterFile

// NewTranslatedFile creates a new TranslatedFile instance by copying the provided ChapterFile.
func NewTranslatedFile(cf *ChapterFile) *TranslatedFile {
	tf := TranslatedFile(*cf)
	return &tf
}

// FilePath returns the expected path of the translated file, which appends "_translated.json" to the original file name.
func (tf *TranslatedFile) FilePath() string {
	ext := filepath.Ext(tf.FileName)
	base := strings.TrimSuffix(tf.FileName, ext)
	return filepath.Join(tf.Dir, base+"_translated.json")
}

// Exists checks if the corresponding translated file exists.
func (tf *TranslatedFile) Exists() bool {
	info, err := os.Stat(tf.FilePath())
	if os.IsNotExist(err) {
		return false
	}
	return err == nil && !info.IsDir()
}

// EnsureExists checks if the translated file exists, and creates an empty one if it doesn't.
// It returns true if the file was newly created, false if it already existed, and an error if one occurred.
func (tf *TranslatedFile) EnsureExists() (bool, error) {
	if tf.Exists() {
		return false, nil
	}

	file, err := os.Create(tf.FilePath())
	if err != nil {
		return false, err
	}
	defer file.Close()

	return true, nil
}

// SaveTranslatedChapter saves the list of chunk deltas back to the translated json file.
func SaveTranslatedChapter(tf *TranslatedFile, chunks []*quilldelta.Delta) error {
	merged := quilldelta.NewDelta()
	for _, chunk := range chunks {
		if chunk != nil {
			merged.Ops = append(merged.Ops, chunk.Ops...)
		}
	}

	data, err := json.Marshal(merged)
	if err != nil {
		return err
	}

	return os.WriteFile(tf.FilePath(), data, 0644)
}

// Read reads the translated file and partitions it to match the original chunks.
// If the file is missing or empty, it returns a slice of empty deltas matching the size of originalChunks.
func (tf *TranslatedFile) Read(originalChunks []*quilldelta.Delta) ([]*quilldelta.Delta, error) {
	if !tf.Exists() {
		chunks := make([]*quilldelta.Delta, len(originalChunks))
		for idx := range chunks {
			chunks[idx] = quilldelta.NewDelta()
		}
		return chunks, nil
	}

	info, err := os.Stat(tf.FilePath())
	if err != nil {
		return nil, err
	}
	if info.Size() == 0 {
		chunks := make([]*quilldelta.Delta, len(originalChunks))
		for idx := range chunks {
			chunks[idx] = quilldelta.NewDelta()
		}
		return chunks, nil
	}

	d, err := quilldelta.NewFromFile(tf.FilePath())
	if err != nil {
		return nil, fmt.Errorf("failed to load translated delta file: %w", err)
	}

	return PartitionTranslatedDelta(d, originalChunks), nil
}

// PartitionTranslatedDelta partitions a translated Delta into chunks that align with the original chunks.
// It maps the natural paragraph blocks of the translated delta one-to-one with the blocks of the original chunks.
func PartitionTranslatedDelta(translatedDelta *quilldelta.Delta, originalChunks []*quilldelta.Delta) []*quilldelta.Delta {
	if len(originalChunks) == 0 {
		return nil
	}

	translatedBlocks := splitDeltaIntoBlocks(translatedDelta)
	translatedChunks := make([]*quilldelta.Delta, len(originalChunks))

	blockIdx := 0
	numTranslatedBlocks := len(translatedBlocks)

	for i, origChunk := range originalChunks {
		origBlocks := splitDeltaIntoBlocks(origChunk)
		numBlocks := len(origBlocks)

		chunkDelta := quilldelta.NewDelta()

		// If this is the last chunk, consume all remaining translated blocks.
		var limit int
		if i == len(originalChunks)-1 {
			limit = numTranslatedBlocks
		} else {
			limit = blockIdx + numBlocks
			if limit > numTranslatedBlocks {
				limit = numTranslatedBlocks
			}
		}

		for blockIdx < limit {
			chunkDelta.Ops = append(chunkDelta.Ops, translatedBlocks[blockIdx].Ops...)
			blockIdx++
		}

		translatedChunks[i] = canonicalizeDelta(chunkDelta)
	}

	return translatedChunks
}
