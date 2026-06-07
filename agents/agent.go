package agents

import (
	"context"
	"errors"
	"fmt"
	"log"
	"runtime/cgo"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/syriku/aisdk/api"
	"github.com/syriku/aisdk/request"
	"github.com/syriku/aisdk/session"
	"github.com/syriku/label-go/comic"
	"github.com/syriku/label-go/label"
	"github.com/syriku/quill-delta/quilldelta"
	"github.com/syriku/transmas/agents/comicagents"
	"github.com/syriku/transmas/agents/comicagents/comicdb"
	"github.com/syriku/transmas/agents/database"
	"github.com/syriku/transmas/agents/meta"
	"github.com/syriku/transmas/agents/novelagents"
	"github.com/syriku/transmas/server"
	"github.com/syriku/transmas/text"
	"github.com/wailsapp/wails/v3/pkg/application"
	"gorm.io/gorm"
)

const (
	TranslationEventName        = "translation-stream"
	TranslateSyncThresholdRatio = 0.5
)

type TranslationResponse struct {
	Async      bool   `json:"async"`
	Handle     string `json:"handle"`
	Translated string `json:"translated,omitempty"`
}

type TranslationEventPayload struct {
	Handle    string `json:"handle"`
	Seq       int    `json:"seq"`
	Text      string `json:"text"`
	Error     string `json:"error"`
	Completed bool   `json:"completed"`
}

type ReusableTranslatorInfo struct {
	ProjectName string
	Model       string
}

type ChunkInfo struct {
	Delta           *quilldelta.Delta `json:"delta"`
	TranslatedDelta *quilldelta.Delta `json:"translatedDelta,omitempty"`
	Current         int               `json:"current"`
	Total           int               `json:"total"`
	UnsavedChanges  bool              `json:"unsavedChanges"`
	Dirty           bool              `json:"dirty"`
}

type ReadWriteAgent interface {
	ReadAgent
	WriteAgent
}

type TranslateAgent interface {
	ProjectAgent
	ChapterAgent
	ConfigAgent
	ReadWriteAgent
	WebAgent
	CreateReusableTranslator(projectName string, model string) (uintptr, error)
	DestroyReusableTranslator(handle uintptr) error
	TranslateWithHandle(handle uintptr, detailed bool) (TranslationResponse, error)
	TranslateWithParams(projectName string, model string, detailed bool) (TranslationResponse, error)
	GetTranslationEventName() string
	CancelTranslation(handle string) error
	GetChapterMeta() (*meta.ChapterMeta, error)
	SetCurrentChunkTranslated(completed bool) error
	SetCurrentChunkReviewed(completed bool) error
	Logout() error
	UpdatePageLabels(projectName string, chapterOrder uint, filename string, labels label.Labels) error
	MergeLabels(projectName string, chapterOrder uint) (label.Labels, error)
	ExportLp(projectName string, chapterOrder uint, filePath string) error
	ImportLp(projectName string, chapterOrder uint, filePath string) error
}

type translateAgentImpl struct {
	userData          database.UserData
	db                *gorm.DB
	chapterFile       *text.ChapterFile
	translatedFile    *text.TranslatedFile
	chunks            []*quilldelta.Delta
	translatedChunks  []*quilldelta.Delta
	currentChunkIndex int
	chapterMu         sync.RWMutex
	originalDirty     bool
	translatedDirty   bool
	activeCancelMu    sync.Mutex
	activeCancels     map[string]context.CancelFunc
	chapterMeta       *meta.ChapterMeta
	webMu             sync.Mutex
	serverRunning     bool
	webServer         server.TransmasClient
	comicAgent        comicagents.ComicAgent
	novelAgent        novelagents.NovelAgent
}

var (
	activeAgentMu sync.RWMutex
	activeAgent   TranslateAgent
)

func IsLoggedIn() bool {
	activeAgentMu.RLock()
	defer activeAgentMu.RUnlock()
	return activeAgent != nil
}

func newTranslateAgentImpl(db *gorm.DB, username string) (*translateAgentImpl, error) {
	impl := &translateAgentImpl{
		db:            db,
		activeCancels: make(map[string]context.CancelFunc),
	}
	err := database.FetchUserData(db, username, &impl.userData)
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		// not found
		impl.userData = database.NewUserData(username)
		err = database.AddUserData(db, &impl.userData)
		if err != nil {
			return nil, err
		}
	}
	impl.comicAgent = comicagents.NewComicAgent()
	impl.novelAgent = novelagents.NewNovelAgent()
	return impl, nil
}

func NewTranslateAgent(db *gorm.DB, username string) (TranslateAgent, error) {
	agent, err := newTranslateAgentImpl(db, username)
	if err != nil {
		return nil, err
	}

	if agent.userData.WebExtensionEnabled {
		if err := agent.startServer(); err != nil {
			log.Printf("failed to start web helper server: %v", err)
			emitWebServerError(err.Error())
		}
	}

	activeAgentMu.Lock()
	activeAgent = agent
	activeAgentMu.Unlock()
	return agent, nil
}

func (i *translateAgentImpl) Logout() error {
	_ = i.stopServer()

	activeAgentMu.Lock()
	if activeAgent == i {
		activeAgent = nil
	}
	activeAgentMu.Unlock()
	return nil
}

func getDeltaText(d *quilldelta.Delta) string {
	if d == nil {
		return ""
	}
	var sb strings.Builder
	for _, op := range d.Ops {
		if textInsert, ok := op.Insert.(quilldelta.TextInsert); ok {
			sb.WriteString(string(textInsert))
		}
	}
	return sb.String()
}

func getReusableTranslatorInfo(handleVal uintptr) (info *ReusableTranslatorInfo, err error) {
	if handleVal == 0 {
		return nil, fmt.Errorf("invalid handle: zero")
	}
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("invalid handle: %v", r)
		}
	}()
	h := cgo.Handle(handleVal)
	info, ok := h.Value().(*ReusableTranslatorInfo)
	if !ok {
		return nil, fmt.Errorf("handle does not point to a ReusableTranslatorInfo")
	}
	return info, nil
}

func (i *translateAgentImpl) CreateReusableTranslator(projectName string, model string) (uintptr, error) {
	info := &ReusableTranslatorInfo{
		ProjectName: projectName,
		Model:       model,
	}
	h := cgo.NewHandle(info)
	return uintptr(h), nil
}

func (i *translateAgentImpl) DestroyReusableTranslator(handle uintptr) error {
	if handle == 0 {
		return fmt.Errorf("invalid handle: zero")
	}
	defer func() {
		_ = recover()
	}()
	h := cgo.Handle(handle)
	h.Delete()
	return nil
}

func (i *translateAgentImpl) GetTranslationEventName() string {
	return TranslationEventName
}

func emitEvent(payload TranslationEventPayload) {
	if app := application.Get(); app != nil && app.Event != nil {
		app.Event.Emit(TranslationEventName, payload)
	}
}

func (i *translateAgentImpl) TranslateWithHandle(handle uintptr, detailed bool) (TranslationResponse, error) {
	info, err := getReusableTranslatorInfo(handle)
	if err != nil {
		return TranslationResponse{}, err
	}
	return i.translateCommon(info.ProjectName, info.Model, fmt.Sprintf("%d", handle), detailed)
}

func (i *translateAgentImpl) TranslateWithParams(projectName string, model string, detailed bool) (TranslationResponse, error) {
	tempHandle := fmt.Sprintf("ot-%d", time.Now().UnixNano())
	return i.translateCommon(projectName, model, tempHandle, detailed)
}

func (i *translateAgentImpl) translateCommon(projectName string, model string, handleStr string, detailed bool) (TranslationResponse, error) {
	i.chapterMu.Lock()
	defer i.chapterMu.Unlock()

	if i.chapterFile == nil || len(i.chunks) == 0 {
		return TranslationResponse{}, fmt.Errorf("no valid chapter file is currently loaded")
	}
	if i.currentChunkIndex < 0 || i.currentChunkIndex >= len(i.chunks) {
		return TranslationResponse{}, fmt.Errorf("invalid current chunk index")
	}

	currentChunk := i.chunks[i.currentChunkIndex]
	sourceText := getDeltaText(currentChunk)
	if strings.TrimSpace(sourceText) == "" {
		return TranslationResponse{}, fmt.Errorf("current chunk is empty")
	}

	aiConfigKey, err := database.FetchProjectAiConfigKey(i.db, i.userData.Username, projectName)
	if err != nil {
		return TranslationResponse{}, fmt.Errorf("failed to fetch project AI config key: %w", err)
	}
	userConfig, err := i.GetAiConfigByKey(aiConfigKey)
	if err != nil {
		return TranslationResponse{}, fmt.Errorf("failed to fetch AI config: %w", err)
	}

	translatorKey, err := database.FetchProjectTranslatorKey(i.db, i.userData.Username, projectName)
	if err != nil {
		return TranslationResponse{}, fmt.Errorf("failed to fetch project translator key: %w", err)
	}
	translator, err := i.GetTranslatorByKey(translatorKey)
	if err != nil {
		return TranslationResponse{}, fmt.Errorf("failed to fetch translator: %w", err)
	}

	glossary, err := i.GetGlossary(projectName)
	if err != nil {
		return TranslationResponse{}, fmt.Errorf("failed to fetch glossary: %w", err)
	}

	var recentHistory []string
	n := len(i.chunks)
	curr := i.currentChunkIndex

	isReviewed := func(idx int) bool {
		if i.chapterMeta == nil {
			return false
		}
		ordinal := idx + 1
		return slices.Contains(i.chapterMeta.ReviewedChunks, ordinal)
	}

	getChunkContext := func(idx int) string {
		if idx < 0 || idx >= n {
			return ""
		}
		src := getDeltaText(i.chunks[idx])
		var trans string
		if idx < len(i.translatedChunks) && i.translatedChunks[idx] != nil {
			trans = getDeltaText(i.translatedChunks[idx])
		}
		if trans == "" {
			return fmt.Sprintf("Source Text:\n%s", src)
		}
		return fmt.Sprintf("Source Text:\n%s\nReference Translation:\n%s", src, trans)
	}

	if detailed {
		if n <= 1 {
			return TranslationResponse{}, fmt.Errorf("no adjacent chunk exists in detailed mode")
		}
		switch curr {
		case 0:
			// First chunk, check next
			if !isReviewed(1) {
				return TranslationResponse{}, fmt.Errorf("adjacent chunk (next) must be reviewed in detailed mode")
			}
			recentHistory = append(recentHistory, getChunkContext(1))
		case n - 1:
			// Last chunk, check prev
			if !isReviewed(n - 2) {
				return TranslationResponse{}, fmt.Errorf("adjacent chunk (prev) must be reviewed in detailed mode")
			}
			recentHistory = append(recentHistory, getChunkContext(n-2))
		default:
			// Middle chunk, check both
			if !isReviewed(curr-1) || !isReviewed(curr+1) {
				return TranslationResponse{}, fmt.Errorf("both adjacent chunks (prev and next) must be reviewed in detailed mode")
			}
			recentHistory = append(recentHistory, getChunkContext(curr-1))
			recentHistory = append(recentHistory, getChunkContext(curr+1))
		}
	} else {
		// Non-detailed mode: prioritize prev, fallback to next if prev not reviewed
		if curr > 0 && isReviewed(curr-1) {
			recentHistory = append(recentHistory, getChunkContext(curr-1))
		} else if curr < n-1 && isReviewed(curr+1) {
			recentHistory = append(recentHistory, getChunkContext(curr+1))
		}
	}

	maxRuneSize := i.chapterFile.MaxChunkRuneSize
	runeLen := len([]rune(sourceText))
	isSync := float64(runeLen) < float64(maxRuneSize)*TranslateSyncThresholdRatio

	factory := api.NewFactory(userConfig)
	if factory == nil {
		return TranslationResponse{}, fmt.Errorf("failed to create API factory for provider type %d", userConfig.Type)
	}
	chatApi := factory.ChatCompletions(model)
	if chatApi == nil {
		return TranslationResponse{}, fmt.Errorf("failed to create ChatCompletions API for model %s", model)
	}

	req := session.NewOneTimeRequest(translator, glossary, recentHistory)

	if isSync {
		req.Translate(context.Background(), chatApi, sourceText)
		if req.Error() != nil {
			return TranslationResponse{}, req.Error()
		}
		translatedText := req.Text()
		if i.currentChunkIndex < len(i.chunks)-1 {
			if !strings.HasSuffix(translatedText, "\n") {
				translatedText += "\n"
			}
		}

		if i.translatedChunks == nil {
			i.translatedChunks = make([]*quilldelta.Delta, len(i.chunks))
			for idx := range i.translatedChunks {
				i.translatedChunks[idx] = quilldelta.NewDelta()
			}
		}
		i.translatedChunks[i.currentChunkIndex] = quilldelta.NewFromText(translatedText)
		i.translatedDirty = true

		return TranslationResponse{
			Async:      false,
			Handle:     handleStr,
			Translated: translatedText,
		}, nil
	} else {
		chunkIndex := i.currentChunkIndex
		chapterFileName := i.chapterFile.FileName

		ctx, cancel := context.WithCancel(context.Background())
		i.activeCancelMu.Lock()
		i.activeCancels[handleStr] = cancel
		i.activeCancelMu.Unlock()

		go func(ctx context.Context, cancel context.CancelFunc, chunkIndex int, chapterFileName string, sourceText string, req session.Request, chatApi api.ChatCompletionsApi) {
			defer func() {
				cancel()
				i.activeCancelMu.Lock()
				delete(i.activeCancels, handleStr)
				i.activeCancelMu.Unlock()
			}()

			responseCh := make(chan string)
			errCh := make(chan error)

			req.TranslateAsync(ctx, chatApi, sourceText, responseCh, errCh)

			var accumulatedText strings.Builder
			var finalErr error
			seq := 0

			for responseCh != nil || errCh != nil {
				select {
				case <-ctx.Done():
					emitEvent(TranslationEventPayload{
						Handle:    handleStr,
						Seq:       seq,
						Error:     "Canceled",
						Completed: true,
					})
					return
				case text, ok := <-responseCh:
					if !ok {
						responseCh = nil
					} else {
						accumulatedText.WriteString(text)
						emitEvent(TranslationEventPayload{
							Handle: handleStr,
							Seq:    seq,
							Text:   text,
						})
						seq++
					}
				case err, ok := <-errCh:
					if !ok {
						errCh = nil
					} else {
						if finalErr == nil {
							finalErr = err
						}
					}
				}
			}

			if ctx.Err() != nil {
				emitEvent(TranslationEventPayload{
					Handle:    handleStr,
					Seq:       seq,
					Error:     "Canceled",
					Completed: true,
				})
				return
			}

			if finalErr != nil {
				emitEvent(TranslationEventPayload{
					Handle:    handleStr,
					Seq:       seq,
					Error:     finalErr.Error(),
					Completed: true,
				})
				return
			}

			translatedText := accumulatedText.String()
			if chunkIndex < len(i.chunks)-1 {
				if !strings.HasSuffix(translatedText, "\n") {
					emitEvent(TranslationEventPayload{
						Handle: handleStr,
						Seq:    seq,
						Text:   "\n",
					})
					seq++
					accumulatedText.WriteString("\n")
					translatedText += "\n"
				}
			}

			i.chapterMu.Lock()
			if i.chapterFile != nil && i.chapterFile.FileName == chapterFileName && chunkIndex < len(i.chunks) {
				if i.translatedChunks == nil {
					i.translatedChunks = make([]*quilldelta.Delta, len(i.chunks))
					for idx := range i.translatedChunks {
						i.translatedChunks[idx] = quilldelta.NewDelta()
					}
				}
				i.translatedChunks[chunkIndex] = quilldelta.NewFromText(translatedText)
				i.translatedDirty = true
			}
			i.chapterMu.Unlock()

			emitEvent(TranslationEventPayload{
				Handle:    handleStr,
				Seq:       seq,
				Completed: true,
			})
		}(ctx, cancel, chunkIndex, chapterFileName, sourceText, req, chatApi)

		return TranslationResponse{
			Async:  true,
			Handle: handleStr,
		}, nil
	}
}

func (i *translateAgentImpl) CancelTranslation(handle string) error {
	i.activeCancelMu.Lock()
	cancel, ok := i.activeCancels[handle]
	if ok {
		cancel()
		delete(i.activeCancels, handle)
	}
	i.activeCancelMu.Unlock()
	return nil
}

func (i *translateAgentImpl) ListProjects() ([]database.ProjectInfo, error) {
	return listProjects(i.db, i.userData.Username)
}

func (i *translateAgentImpl) AddProject(title string, projectType database.ProjectType) error {
	return addProject(i.db, i.userData.Username, title, projectType)
}

func (i *translateAgentImpl) RenameProject(oldTitle string, newTitle string) error {
	return renameProject(i.db, i.userData.Username, oldTitle, newTitle)
}

func (i *translateAgentImpl) UpdateProjectDir(title string, dir string) error {
	err := updateProjectDir(i.db, i.userData.Username, title, dir)
	if err != nil {
		return err
	}

	proj, err := database.FetchProjectByOwnerAndTitle(i.db, i.userData.Username, title)
	if err != nil {
		return err
	}
	if proj.ProjectType == database.ProjectTypeComic && dir != "" {
		err = i.comicAgent.EnsureProject(comicagents.NewComic(func(wc *comic.WorkComic) {
			wc.Title = proj.Title
			wc.WorkDir = dir
		}))
		if err != nil {
			return err
		}
	}
	if proj.ProjectType == database.ProjectTypeNovel && dir != "" {
		err = i.novelAgent.EnsureProject(proj.Title, dir)
		if err != nil {
			return err
		}
	}
	return nil
}

func (i *translateAgentImpl) GetGlossary(title string) ([]request.GlossaryEntry, error) {
	proj, err := database.FetchProjectByOwnerAndTitle(i.db, i.userData.Username, title)
	if err != nil {
		return nil, err
	}
	if proj.ProjectType == database.ProjectTypeNovel {
		return i.novelAgent.GetGlossary(proj.WorkDir)
	}
	return getGlossary(i.db, i.userData.Username, title)
}

func (i *translateAgentImpl) UpdateGlossary(title string, glossary []request.GlossaryEntry) error {
	proj, err := database.FetchProjectByOwnerAndTitle(i.db, i.userData.Username, title)
	if err != nil {
		return err
	}
	if proj.ProjectType == database.ProjectTypeNovel {
		return i.novelAgent.UpdateGlossary(proj.WorkDir, glossary)
	}
	return updateGlossary(i.db, i.userData.Username, title, glossary)
}

func (i *translateAgentImpl) DeleteProject(title string) error {
	return deleteProject(i.db, i.userData.Username, title)
}

func (i *translateAgentImpl) ListChapters(projectName string) ([]database.Chapter, error) {
	proj, err := database.FetchProjectByOwnerAndTitle(i.db, i.userData.Username, projectName)
	if err != nil {
		return nil, err
	}
	if proj.ProjectType == database.ProjectTypeComic {
		if proj.WorkDir == "" {
			return nil, nil
		}
		// Ensure database is initialized
		err = i.comicAgent.EnsureProject(comicagents.NewComic(func(wc *comic.WorkComic) {
			wc.Title = proj.Title
			wc.WorkDir = proj.WorkDir
		}))
		if err != nil {
			return nil, err
		}
		comicChapters, err := i.comicAgent.ListChapters(proj.WorkDir)
		if err != nil {
			return nil, err
		}
		result := make([]database.Chapter, len(comicChapters))
		for i, ch := range comicChapters {
			result[i] = database.Chapter{
				Order:   ch.Order,
				Title:   ch.Title,
				Project: proj.ID,
			}
		}
		return result, nil
	}

	novelChapters, err := i.novelAgent.ListChapters(proj.WorkDir)
	if err != nil {
		return nil, err
	}
	result := make([]database.Chapter, len(novelChapters))
	for i, ch := range novelChapters {
		result[i] = database.Chapter{
			Order:   ch.Order,
			Title:   ch.Title,
			Project: proj.ID,
		}
	}
	return result, nil
}

func (i *translateAgentImpl) AddChapter(projectName string, order uint, title string) error {
	proj, err := database.FetchProjectByOwnerAndTitle(i.db, i.userData.Username, projectName)
	if err != nil {
		return err
	}
	if proj.ProjectType == database.ProjectTypeComic {
		if proj.WorkDir == "" {
			return fmt.Errorf("project work directory not set")
		}
		return i.comicAgent.AddChapter(proj.WorkDir, order, title)
	}

	return i.novelAgent.AddChapter(proj.WorkDir, order, title)
}

func (i *translateAgentImpl) UpdateChapterTitle(projectName string, order uint, title string) error {
	proj, err := database.FetchProjectByOwnerAndTitle(i.db, i.userData.Username, projectName)
	if err != nil {
		return err
	}
	if proj.ProjectType == database.ProjectTypeComic {
		if proj.WorkDir == "" {
			return fmt.Errorf("project work directory not set")
		}
		return i.comicAgent.UpdateChapterTitle(proj.WorkDir, order, title)
	}

	return i.novelAgent.UpdateChapterTitle(proj.WorkDir, order, title)
}

func (i *translateAgentImpl) DeleteChapter(projectName string, order uint) error {
	proj, err := database.FetchProjectByOwnerAndTitle(i.db, i.userData.Username, projectName)
	if err != nil {
		return err
	}
	if proj.ProjectType == database.ProjectTypeComic {
		if proj.WorkDir == "" {
			return fmt.Errorf("project work directory not set")
		}
		return i.comicAgent.DeleteChapter(proj.WorkDir, order)
	}

	return i.novelAgent.DeleteChapter(proj.WorkDir, order)
}

func (i *translateAgentImpl) UpdateChapterPages(projectName string, chapterOrder uint, pages []string) error {
	proj, err := database.FetchProjectByOwnerAndTitle(i.db, i.userData.Username, projectName)
	if err != nil {
		return err
	}
	if proj.ProjectType != database.ProjectTypeComic {
		return fmt.Errorf("project is not a comic project")
	}
	if proj.WorkDir == "" {
		return fmt.Errorf("project work directory not set")
	}
	return i.comicAgent.UpdateChapterPages(proj.WorkDir, chapterOrder, pages)
}

func (i *translateAgentImpl) GetChapterPageMetas(projectName string, chapterOrder uint) ([]comicdb.PageMeta, error) {
	proj, err := database.FetchProjectByOwnerAndTitle(i.db, i.userData.Username, projectName)
	if err != nil {
		return nil, err
	}
	if proj.ProjectType != database.ProjectTypeComic {
		return nil, fmt.Errorf("project is not a comic project")
	}
	if proj.WorkDir == "" {
		return nil, fmt.Errorf("project work directory not set")
	}
	return i.comicAgent.GetChapterPageMetas(proj.WorkDir, chapterOrder)
}

func (i *translateAgentImpl) GetChapterTags(projectName string, chapterOrder uint) ([]string, error) {
	proj, err := database.FetchProjectByOwnerAndTitle(i.db, i.userData.Username, projectName)
	if err != nil {
		return nil, err
	}
	if proj.ProjectType != database.ProjectTypeComic {
		return nil, fmt.Errorf("project is not a comic project")
	}
	if proj.WorkDir == "" {
		return nil, fmt.Errorf("project work directory not set")
	}
	return i.comicAgent.GetChapterTags(proj.WorkDir, chapterOrder)
}

func (i *translateAgentImpl) SetChapterTags(projectName string, chapterOrder uint, tags []string) error {
	proj, err := database.FetchProjectByOwnerAndTitle(i.db, i.userData.Username, projectName)
	if err != nil {
		return err
	}
	if proj.ProjectType != database.ProjectTypeComic {
		return fmt.Errorf("project is not a comic project")
	}
	if proj.WorkDir == "" {
		return fmt.Errorf("project work directory not set")
	}
	return i.comicAgent.SetChapterTags(proj.WorkDir, chapterOrder, tags)
}

func (i *translateAgentImpl) UpdatePageLabels(projectName string, chapterOrder uint, filename string, labels label.Labels) error {
	proj, err := database.FetchProjectByOwnerAndTitle(i.db, i.userData.Username, projectName)
	if err != nil {
		return err
	}
	if proj.ProjectType != database.ProjectTypeComic {
		return fmt.Errorf("project is not a comic project")
	}
	if proj.WorkDir == "" {
		return fmt.Errorf("project work directory not set")
	}
	return i.comicAgent.UpdatePageLabels(proj.WorkDir, chapterOrder, filename, labels)
}

func (i *translateAgentImpl) MergeLabels(projectName string, chapterOrder uint) (label.Labels, error) {
	proj, err := database.FetchProjectByOwnerAndTitle(i.db, i.userData.Username, projectName)
	if err != nil {
		return nil, err
	}
	if proj.ProjectType != database.ProjectTypeComic {
		return nil, fmt.Errorf("project is not a comic project")
	}
	if proj.WorkDir == "" {
		return nil, fmt.Errorf("project work directory not set")
	}
	return i.comicAgent.MergeLabels(proj.WorkDir, chapterOrder)
}

func (i *translateAgentImpl) ExportLp(projectName string, chapterOrder uint, filePath string) error {
	proj, err := database.FetchProjectByOwnerAndTitle(i.db, i.userData.Username, projectName)
	if err != nil {
		return err
	}
	if proj.ProjectType != database.ProjectTypeComic {
		return fmt.Errorf("project is not a comic project")
	}
	if proj.WorkDir == "" {
		return fmt.Errorf("project work directory not set")
	}
	return i.comicAgent.ExportLp(proj.WorkDir, chapterOrder, filePath)
}

func (i *translateAgentImpl) ImportLp(projectName string, chapterOrder uint, filePath string) error {
	proj, err := database.FetchProjectByOwnerAndTitle(i.db, i.userData.Username, projectName)
	if err != nil {
		return err
	}
	if proj.ProjectType != database.ProjectTypeComic {
		return fmt.Errorf("project is not a comic project")
	}
	if proj.WorkDir == "" {
		return fmt.Errorf("project work directory not set")
	}
	return i.comicAgent.ImportLp(proj.WorkDir, chapterOrder, filePath)
}

func (i *translateAgentImpl) GetChapterMeta() (*meta.ChapterMeta, error) {
	i.chapterMu.RLock()
	defer i.chapterMu.RUnlock()

	if i.chapterFile == nil {
		return nil, fmt.Errorf("no chapter is currently loaded")
	}
	return i.chapterMeta, nil
}

func (i *translateAgentImpl) SetCurrentChunkTranslated(completed bool) error {
	i.chapterMu.Lock()
	defer i.chapterMu.Unlock()

	if i.chapterFile == nil || i.chapterMeta == nil {
		return fmt.Errorf("no chapter is currently loaded")
	}

	i.chapterMeta.SetTranslated(i.currentChunkIndex, completed)
	return i.novelAgent.SaveChapterMeta(i.chapterFile.Dir, i.chapterMeta.ChapterOrder, i.chapterMeta)
}

func (i *translateAgentImpl) SetCurrentChunkReviewed(completed bool) error {
	i.chapterMu.Lock()
	defer i.chapterMu.Unlock()

	if i.chapterFile == nil || i.chapterMeta == nil {
		return fmt.Errorf("no chapter is currently loaded")
	}

	i.chapterMeta.SetReviewed(i.currentChunkIndex, completed)
	return i.novelAgent.SaveChapterMeta(i.chapterFile.Dir, i.chapterMeta.ChapterOrder, i.chapterMeta)
}
