package agents

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/syriku/quill-delta/quilldelta"
	"github.com/syriku/transmas/agents/meta"
)

type WriteAgent interface {
	UpdateOriginalChunk(newDelta *quilldelta.Delta) error
	UpdateTranslatedChunk(newDelta *quilldelta.Delta) error
	SaveChapter() error
	ExportTranslatedChapter(filePath string) error
}

func (i *translateAgentImpl) UpdateOriginalChunk(newDelta *quilldelta.Delta) error {
	i.chapterMu.Lock()
	defer i.chapterMu.Unlock()

	if i.chapterFile == nil || len(i.chunks) == 0 {
		return fmt.Errorf("no valid chapter file is currently loaded")
	}

	i.chunks[i.currentChunkIndex] = newDelta
	i.originalDirty = true
	return nil
}

func (i *translateAgentImpl) UpdateTranslatedChunk(newDelta *quilldelta.Delta) error {
	i.chapterMu.Lock()
	defer i.chapterMu.Unlock()

	if i.chapterFile == nil || len(i.chunks) == 0 {
		return fmt.Errorf("no valid chapter file is currently loaded")
	}

	if i.translatedChunks == nil {
		i.translatedChunks = make([]*quilldelta.Delta, len(i.chunks))
		for idx := range i.translatedChunks {
			i.translatedChunks[idx] = quilldelta.NewDelta()
		}
	}

	i.translatedChunks[i.currentChunkIndex] = newDelta
	i.translatedDirty = true
	return nil
}

func serializeChunks(chunks []*quilldelta.Delta) ([]byte, error) {
	merged := quilldelta.NewDelta()
	for _, chunk := range chunks {
		if chunk != nil {
			merged.Ops = append(merged.Ops, chunk.Ops...)
		}
	}
	return json.Marshal(merged)
}

func writeFileWithContext(ctx context.Context, filePath string, data []byte) error {
	ch := make(chan error, 1)
	go func() {
		ch <- os.WriteFile(filePath, data, 0644)
	}()
	select {
	case err := <-ch:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (i *translateAgentImpl) saveOriginalChapter(ctx context.Context, data []byte) error {
	if len(data) == 0 {
		return nil
	}
	return writeFileWithContext(ctx, i.chapterFile.JSONFilePath(), data)
}

func (i *translateAgentImpl) saveTranslatedChapter(ctx context.Context, data []byte) error {
	if len(data) == 0 {
		return nil
	}
	return writeFileWithContext(ctx, i.translatedFile.FilePath(), data)
}

func (i *translateAgentImpl) SaveChapter() error {
	i.chapterMu.Lock()
	defer i.chapterMu.Unlock()

	if i.chapterFile == nil || len(i.chunks) == 0 {
		return fmt.Errorf("no valid chapter file is currently loaded")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var originalData []byte
	var err error
	if i.originalDirty {
		originalData, err = serializeChunks(i.chunks)
		if err != nil {
			return err
		}
	}

	var translatedData []byte
	if i.translatedDirty && i.translatedChunks != nil {
		translatedData, err = serializeChunks(i.translatedChunks)
		if err != nil {
			return err
		}
	}

	// If nothing is dirty, do nothing
	if originalData == nil && translatedData == nil {
		return nil
	}

	errChan := make(chan error, 2)
	var wg sync.WaitGroup

	if originalData != nil {
		wg.Add(1)
		go func(data []byte) {
			defer wg.Done()
			if err := i.saveOriginalChapter(ctx, data); err != nil {
				errChan <- err
			}
		}(originalData)
	}

	if translatedData != nil {
		wg.Add(1)
		go func(data []byte) {
			defer wg.Done()
			if err := i.saveTranslatedChapter(ctx, data); err != nil {
				errChan <- err
			}
		}(translatedData)
	}

	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		close(errChan)
		var combinedErr error
		for err := range errChan {
			if combinedErr == nil {
				combinedErr = err
			} else {
				combinedErr = fmt.Errorf("%v; %v", combinedErr, err)
			}
		}
		if combinedErr != nil {
			return combinedErr
		}

		if i.chapterMeta != nil {
			var indices []int
			for idx, chunk := range i.translatedChunks {
				if chunk != nil && len(chunk.Ops) > 0 {
					var sb strings.Builder
					for _, op := range chunk.Ops {
						if textInsert, ok := op.Insert.(quilldelta.TextInsert); ok {
							sb.WriteString(string(textInsert))
						}
					}
					if strings.TrimSpace(sb.String()) != "" {
						indices = append(indices, idx+1)
					}
				}
			}
			i.chapterMeta.TranslatedChunks = indices
			i.chapterMeta.LastChunkCount = len(i.chunks)
			if i.chapterFile != nil {
				i.chapterMeta.LastChunkSize = i.chapterFile.MaxChunkRuneSize
				meta.SaveMetaAsync(i.chapterFile.Dir, i.chapterFile.FileName, i.chapterMeta)
			}
		}

		if originalData != nil {
			i.originalDirty = false
		}
		if translatedData != nil {
			i.translatedDirty = false
		}
		return nil

	case <-ctx.Done():
		return ctx.Err()
	}
}

func (i *translateAgentImpl) ExportTranslatedChapter(filePath string) error {
	i.chapterMu.RLock()
	defer i.chapterMu.RUnlock()

	if i.chapterFile == nil {
		return fmt.Errorf("no valid chapter file is currently loaded")
	}

	var sb strings.Builder
	for _, chunk := range i.translatedChunks {
		sb.WriteString(getDeltaText(chunk))
	}

	return os.WriteFile(filePath, []byte(sb.String()), 0644)
}
