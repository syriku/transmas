package text

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/syriku/quill-delta/quilldelta"
)

// ChapterFile manages raw chapter file operations on the filesystem.
type ChapterFile struct {
	Dir              string
	FileName         string
	MaxChunkRuneSize int
}

// NewChapterFile creates a new ChapterFile instance with specified directory, file name, and max chunk rune size.
func NewChapterFile(dir string, fileName string, maxChunkRuneSize int) *ChapterFile {
	return &ChapterFile{
		Dir:              dir,
		FileName:         fileName,
		MaxChunkRuneSize: maxChunkRuneSize,
	}
}

// readAll returns the full content of the chapter file.
func (cf *ChapterFile) readAll() (string, error) {
	filePath := filepath.Join(cf.Dir, cf.FileName)
	content, err := os.ReadFile(filePath)
	if err != nil {
		return "", err
	}
	return string(content), nil
}

// IsLargeFile checks if the chapter file size in bytes exceeds the stored MaxChunkRuneSize.
func (cf *ChapterFile) IsLargeFile() (bool, error) {
	filePath := filepath.Join(cf.Dir, cf.FileName)
	info, err := os.Stat(filePath)
	if err != nil {
		return false, err
	}
	return info.Size() > int64(cf.MaxChunkRuneSize), nil
}

// jsonFilePath returns the path to the associated .json delta file.
// If the original file name is e.g. "chapter1.txt", the JSON file path will be "chapter1.json".
func (cf *ChapterFile) jsonFilePath() string {
	ext := filepath.Ext(cf.FileName)
	base := strings.TrimSuffix(cf.FileName, ext)
	return filepath.Join(cf.Dir, base+".json")
}

// JSONFilePath returns the path to the associated .json delta file.
func (cf *ChapterFile) JSONFilePath() string {
	return cf.jsonFilePath()
}

// jsonExists checks if the JSON delta file exists.
func (cf *ChapterFile) jsonExists() bool {
	path := cf.jsonFilePath()
	info, err := os.Stat(path)
	if os.IsNotExist(err) {
		return false
	}
	return err == nil && !info.IsDir()
}

// ReadChapter reads and splits the entire chapter file into chunks of Deltas based on MaxChunkRuneSize.
// It checks for a JSON delta file first; if not present, it reads the plain text file and converts it.
func ReadChapter(dir string, title string, chunkSize int) (*ChapterFile, []*quilldelta.Delta, error) {
	cf := NewChapterFile(dir, title, chunkSize)

	var d *quilldelta.Delta
	var err error

	if cf.jsonExists() {
		d, err = quilldelta.NewFromFile(cf.jsonFilePath())
		if err != nil {
			return cf, nil, fmt.Errorf("failed to load delta file: %w", err)
		}
	} else {
		content, err := cf.readAll()
		if err != nil {
			return cf, nil, fmt.Errorf("failed to read plain text file: %w", err)
		}
		d = quilldelta.NewFromText(content)
	}

	chunks := PartitionDelta(d, cf.MaxChunkRuneSize)
	return cf, chunks, nil
}

// isDeltaLineEmpty checks if a Delta line contains only whitespace
func isDeltaLineEmpty(d *quilldelta.Delta) bool {
	for _, op := range d.Ops {
		switch insert := op.Insert.(type) {
		case quilldelta.TextInsert:
			if strings.TrimSpace(string(insert)) != "" {
				return false
			}
		case quilldelta.ObjectInsert:
			return false
		}
	}
	return true
}

func attrsEqual(a, b map[string]any) bool {
	if len(a) != len(b) {
		return false
	}
	for k, v := range a {
		if bVal, ok := b[k]; !ok || v != bVal {
			return false
		}
	}
	return true
}

func canonicalizeDelta(d *quilldelta.Delta) *quilldelta.Delta {
	merged := quilldelta.NewDelta()
	for _, op := range d.Ops {
		if len(merged.Ops) > 0 {
			lastOp := &merged.Ops[len(merged.Ops)-1]
			if lastText, ok1 := lastOp.Insert.(quilldelta.TextInsert); ok1 {
				if currentText, ok2 := op.Insert.(quilldelta.TextInsert); ok2 {
					if attrsEqual(lastOp.Attributes, op.Attributes) {
						lastOp.Insert = quilldelta.TextInsert(string(lastText) + string(currentText))
						continue
					}
				}
			}
		}
		merged.Ops = append(merged.Ops, op)
	}
	return merged
}

// splitDeltaIntoBlocks splits a Delta into natural paragraph blocks.
func splitDeltaIntoBlocks(d *quilldelta.Delta) []*quilldelta.Delta {
	if len(d.Ops) == 0 {
		return nil
	}

	// Step 1: Split the Delta into individual lines (each ending with \n, or the last remainder)
	var lines []*quilldelta.Delta
	currentLine := quilldelta.NewDelta()

	for _, op := range d.Ops {
		switch insert := op.Insert.(type) {
		case quilldelta.TextInsert:
			textStr := string(insert)
			subBlocks := splitIntoBlocks(textStr)

			for _, sb := range subBlocks {
				currentLine.Insert(sb, op.Attributes)
				if strings.HasSuffix(sb, "\n") {
					lines = append(lines, currentLine)
					currentLine = quilldelta.NewDelta()
				}
			}
		case quilldelta.ObjectInsert:
			currentLine.Ops = append(currentLine.Ops, op)
		default:
			// Non-insert ops (delete, retain) are just appended
			currentLine.Ops = append(currentLine.Ops, op)
		}
	}
	if len(currentLine.Ops) > 0 {
		lines = append(lines, currentLine)
	}

	// Step 2: Group lines into natural paragraph blocks
	var blocks []*quilldelta.Delta
	var currentBlock *quilldelta.Delta
	var isCurrentEmpty bool

	for _, line := range lines {
		isEmpty := isDeltaLineEmpty(line)
		if currentBlock == nil {
			currentBlock = quilldelta.NewDelta()
			currentBlock.Ops = append(currentBlock.Ops, line.Ops...)
			isCurrentEmpty = isEmpty
		} else if isCurrentEmpty == isEmpty {
			currentBlock.Ops = append(currentBlock.Ops, line.Ops...)
		} else {
			blocks = append(blocks, canonicalizeDelta(currentBlock))
			currentBlock = quilldelta.NewDelta()
			currentBlock.Ops = append(currentBlock.Ops, line.Ops...)
			isCurrentEmpty = isEmpty
		}
	}
	if currentBlock != nil {
		blocks = append(blocks, canonicalizeDelta(currentBlock))
	}

	return blocks
}

// PartitionDelta slices a single Delta into multiple smaller Deltas based on maxRuneSize.
// Each smaller Delta represents a chunk. The split occurs ONLY at natural paragraph boundaries.
func PartitionDelta(d *quilldelta.Delta, maxRuneSize int) []*quilldelta.Delta {
	if len(d.Ops) == 0 {
		return nil
	}
	if maxRuneSize <= 0 {
		return []*quilldelta.Delta{d}
	}

	blocks := splitDeltaIntoBlocks(d)

	// Step 3: Group blocks into chunks based on maxRuneSize
	var chunks []*quilldelta.Delta
	currentChunk := quilldelta.NewDelta()
	currentLength := 0

	for _, block := range blocks {
		currentChunk.Ops = append(currentChunk.Ops, block.Ops...)
		currentLength += getDeltaTextLength(block)

		if currentLength >= maxRuneSize && isDeltaLineEmpty(block) {
			chunks = append(chunks, currentChunk)
			currentChunk = quilldelta.NewDelta()
			currentLength = 0
		}
	}

	if len(currentChunk.Ops) > 0 {
		chunks = append(chunks, currentChunk)
	}

	return chunks
}

// getDeltaTextLength calculates the plain text length of a Delta (in runes).
func getDeltaTextLength(d *quilldelta.Delta) int {
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

// splitIntoBlocks splits a string into substrings where each substring ends with a \n,
// except possibly the very last one.
// e.g. "abc\ndef\n" -> ["abc\n", "def\n"]
// e.g. "abc\ndef" -> ["abc\n", "def"]
func splitIntoBlocks(s string) []string {
	var blocks []string
	start := 0
	for i, r := range s {
		if r == '\n' {
			blocks = append(blocks, s[start:i+1])
			start = i + 1
		}
	}
	if start < len(s) {
		blocks = append(blocks, s[start:])
	}
	return blocks
}

// SaveChapterOriginal saves the list of chunk deltas back to the json file.
func SaveChapterOriginal(cf *ChapterFile, chunks []*quilldelta.Delta) error {
	merged := quilldelta.NewDelta()
	for _, chunk := range chunks {
		merged.Ops = append(merged.Ops, chunk.Ops...)
	}

	data, err := json.Marshal(merged)
	if err != nil {
		return err
	}

	return os.WriteFile(cf.jsonFilePath(), data, 0644)
}
