package agents

import (
	"fmt"
	"strings"

	"github.com/syriku/quill-delta/quilldelta"
	"github.com/syriku/transmas/agents/database"
	"github.com/syriku/transmas/agents/meta"
	"github.com/syriku/transmas/text"
)

type ReadAgent interface {
	ReadChapter(projectName string, chapterOrder uint, force bool) (ChunkInfo, error)
	NextChunk() (ChunkInfo, error)
	PrevChunk() (ChunkInfo, error)
	GetChapterStatus(projectName string, chapterOrder uint) (meta.ChapterStatus, error)
}

func (i *translateAgentImpl) ReadChapter(projectName string, chapterOrder uint, force bool) (ChunkInfo, error) {
	proj, err := database.FetchProjectByOwnerAndTitle(i.db, i.userData.Username, projectName)
	if err != nil {
		return ChunkInfo{}, fmt.Errorf("failed to fetch project: %w", err)
	}
	if proj.ProjectType != database.ProjectTypeNovel {
		return ChunkInfo{}, fmt.Errorf("project is not a novel project")
	}

	var chapter database.Chapter
	err = i.db.Where(&database.Chapter{Project: proj.ID, Order: chapterOrder}).First(&chapter).Error
	if err != nil {
		return ChunkInfo{}, fmt.Errorf("failed to fetch chapter: %w", err)
	}

	filename := chapter.Title
	if !strings.HasSuffix(filename, ".txt") {
		filename = filename + ".txt"
	}

	i.chapterMu.Lock()
	isSameChapter := i.chapterFile != nil && i.chapterFile.Dir == proj.WorkDir && i.chapterFile.FileName == filename
	if isSameChapter {
		if len(i.chunks) == 0 {
			i.chapterMu.Unlock()
			return ChunkInfo{Dirty: i.originalDirty || i.translatedDirty}, nil
		}
		info := ChunkInfo{
			Delta:   i.chunks[i.currentChunkIndex],
			Current: i.currentChunkIndex + 1,
			Total:   len(i.chunks),
			Dirty:   i.originalDirty || i.translatedDirty,
		}
		if len(i.translatedChunks) > i.currentChunkIndex {
			info.TranslatedDelta = i.translatedChunks[i.currentChunkIndex]
		}
		i.chapterMu.Unlock()
		return info, nil
	}

	if !force && (i.originalDirty || i.translatedDirty) {
		i.chapterMu.Unlock()
		return ChunkInfo{UnsavedChanges: true}, nil
	}
	i.chapterMu.Unlock()

	cf, chunks, err := text.ReadChapter(proj.WorkDir, filename, 1000)
	if err != nil {
		return ChunkInfo{}, fmt.Errorf("failed to read chapter file: %w", err)
	}

	tf := text.NewTranslatedFile(cf)
	_, err = tf.EnsureExists()
	if err != nil {
		return ChunkInfo{}, fmt.Errorf("failed to ensure translated file exists: %w", err)
	}

	translatedChunks, err := tf.Read(chunks)
	if err != nil {
		return ChunkInfo{}, fmt.Errorf("failed to read translated file: %w", err)
	}

	m, err := meta.LoadMeta(proj.WorkDir, filename)
	if err != nil {
		return ChunkInfo{}, fmt.Errorf("failed to load chapter meta: %w", err)
	}

	m.ProjectName = projectName
	m.ChapterOrder = chapterOrder
	m.ChapterTitle = filename

	if m.LastChunkSize > 0 && m.LastChunkSize != cf.MaxChunkRuneSize {
		// Size changed: perform conversion
		fullDelta := quilldelta.NewDelta()
		for _, chunk := range chunks {
			if chunk != nil {
				fullDelta.Ops = append(fullDelta.Ops, chunk.Ops...)
			}
		}

		m.TranslatedChunks = meta.ConvertIndicesForSizeChange(m.TranslatedChunks, m.LastChunkSize, cf.MaxChunkRuneSize, fullDelta)
		m.ReviewedChunks = meta.ConvertIndicesForSizeChange(m.ReviewedChunks, m.LastChunkSize, cf.MaxChunkRuneSize, fullDelta)
	} else if m.LastChunkSize == 0 {
		// New meta, initialize from currently loaded translatedChunks
		var indices []int
		for idx, chunk := range translatedChunks {
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
		m.TranslatedChunks = indices
	}

	m.LastChunkSize = cf.MaxChunkRuneSize
	m.LastChunkCount = len(chunks)

	// Save meta asynchronously
	meta.SaveMetaAsync(proj.WorkDir, filename, m)

	i.chapterMu.Lock()
	i.chapterFile = cf
	i.translatedFile = tf
	i.chunks = chunks
	i.translatedChunks = translatedChunks
	i.currentChunkIndex = 0
	i.originalDirty = false
	i.translatedDirty = false
	i.chapterMeta = m
	i.chapterMu.Unlock()

	if len(chunks) == 0 {
		return ChunkInfo{Dirty: false}, nil
	}
	info := ChunkInfo{
		Delta:   chunks[0],
		Current: 1,
		Total:   len(chunks),
		Dirty:   false,
	}
	i.chapterMu.Lock()
	if len(i.translatedChunks) > 0 {
		info.TranslatedDelta = i.translatedChunks[0]
	}
	i.chapterMu.Unlock()
	return info, nil
}

func (i *translateAgentImpl) NextChunk() (ChunkInfo, error) {
	i.chapterMu.Lock()
	defer i.chapterMu.Unlock()

	if i.chapterFile == nil || len(i.chunks) == 0 {
		return ChunkInfo{}, fmt.Errorf("no valid chapter file is currently loaded")
	}

	if i.currentChunkIndex+1 >= len(i.chunks) {
		return ChunkInfo{}, fmt.Errorf("already at the last chunk")
	}

	i.currentChunkIndex++
	info := ChunkInfo{
		Delta:   i.chunks[i.currentChunkIndex],
		Current: i.currentChunkIndex + 1,
		Total:   len(i.chunks),
		Dirty:   i.originalDirty || i.translatedDirty,
	}
	if i.translatedChunks != nil && len(i.translatedChunks) > i.currentChunkIndex {
		info.TranslatedDelta = i.translatedChunks[i.currentChunkIndex]
	}
	return info, nil
}

func (i *translateAgentImpl) PrevChunk() (ChunkInfo, error) {
	i.chapterMu.Lock()
	defer i.chapterMu.Unlock()

	if i.chapterFile == nil || len(i.chunks) == 0 {
		return ChunkInfo{}, fmt.Errorf("no valid chapter file is currently loaded")
	}

	if i.currentChunkIndex-1 < 0 {
		return ChunkInfo{}, fmt.Errorf("already at the first chunk")
	}

	i.currentChunkIndex--
	info := ChunkInfo{
		Delta:   i.chunks[i.currentChunkIndex],
		Current: i.currentChunkIndex + 1,
		Total:   len(i.chunks),
		Dirty:   i.originalDirty || i.translatedDirty,
	}
	if i.translatedChunks != nil && len(i.translatedChunks) > i.currentChunkIndex {
		info.TranslatedDelta = i.translatedChunks[i.currentChunkIndex]
	}
	return info, nil
}

func (i *translateAgentImpl) GetChapterStatus(projectName string, chapterOrder uint) (meta.ChapterStatus, error) {
	proj, err := database.FetchProjectByOwnerAndTitle(i.db, i.userData.Username, projectName)
	if err != nil {
		return meta.StatusUncompleted, fmt.Errorf("failed to fetch project: %w", err)
	}
	if proj.ProjectType == database.ProjectTypeComic {
		if proj.WorkDir == "" {
			return meta.StatusUncompleted, nil
		}
		return i.comicAgent.GetChapterStatus(proj.WorkDir, chapterOrder)
	}
	if proj.ProjectType != database.ProjectTypeNovel {
		return meta.StatusUncompleted, fmt.Errorf("project is not a novel project")
	}

	var chapter database.Chapter
	err = i.db.Where(&database.Chapter{Project: proj.ID, Order: chapterOrder}).First(&chapter).Error
	if err != nil {
		return meta.StatusUncompleted, fmt.Errorf("failed to fetch chapter: %w", err)
	}

	filename := chapter.Title
	if !strings.HasSuffix(filename, ".txt") {
		filename = filename + ".txt"
	}

	i.chapterMu.RLock()
	isSameChapter := i.chapterFile != nil && i.chapterFile.Dir == proj.WorkDir && i.chapterFile.FileName == filename
	if isSameChapter {
		m := i.chapterMeta
		totalChunks := len(i.chunks)
		i.chapterMu.RUnlock()

		if m == nil {
			return meta.StatusUncompleted, nil
		}
		return m.GetStatus(totalChunks), nil
	}
	i.chapterMu.RUnlock()

	// Not the cached chapter: only read the existing Meta file
	m, err := meta.LoadMeta(proj.WorkDir, filename)
	if err != nil {
		return meta.StatusUncompleted, fmt.Errorf("failed to load chapter meta: %w", err)
	}

	return m.GetStatus(m.LastChunkCount), nil
}
