package service

import (
	"fmt"
	"sync"

	"github.com/syriku/aisdk/api"
	"github.com/syriku/aisdk/request"
	"github.com/syriku/quill-delta/quilldelta"
	"github.com/syriku/transmas/agents"
	"github.com/syriku/transmas/agents/comicagents/comicdb"
	"github.com/syriku/transmas/agents/database"
	"github.com/syriku/transmas/agents/meta"
	"gorm.io/gorm"
)

type AgentService struct {
	db    *gorm.DB
	agent agents.TranslateAgent
	mu    sync.RWMutex
}

func NewAgentService() *AgentService {
	return &AgentService{}
}

func (a *AgentService) LogIn(username string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	if a.db == nil {
		db, err := database.ConnectDB()
		if err != nil {
			return fmt.Errorf("failed to connect to database: %w", err)
		}
		a.db = db
	}

	agent, err := agents.NewTranslateAgent(a.db, username)
	if err != nil {
		return err
	}

	a.agent = agent
	return nil
}

func (a *AgentService) LogOut() error {
	a.mu.Lock()
	defer a.mu.Unlock()

	if a.agent != nil {
		_ = a.agent.Logout()
		a.agent = nil
	}

	if a.db != nil {
		sqlDB, err := a.db.DB()
		if err == nil {
			sqlDB.Close()
		}
		a.db = nil
	}
	return nil
}

func (a *AgentService) GetAiConfig() (map[string]api.UserConfig, error) {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return nil, fmt.Errorf("log in first please")
	}
	return agent.GetAiConfig()
}

func (a *AgentService) UpdateAiConfig(aiConfig map[string]api.UserConfig) error {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return fmt.Errorf("log in first please")
	}
	return agent.UpdateAiConfig(aiConfig)
}

func (a *AgentService) ListProjects() ([]database.ProjectInfo, error) {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return nil, fmt.Errorf("log in first please")
	}
	return agent.ListProjects()
}

func (a *AgentService) AddProject(title string, projectType database.ProjectType) error {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return fmt.Errorf("log in first please")
	}
	return agent.AddProject(title, projectType)
}

func (a *AgentService) RenameProject(oldTitle string, newTitle string) error {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return fmt.Errorf("log in first please")
	}
	return agent.RenameProject(oldTitle, newTitle)
}

func (a *AgentService) UpdateProjectDir(title string, dir string) error {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return fmt.Errorf("log in first please")
	}
	return agent.UpdateProjectDir(title, dir)
}

func (a *AgentService) DeleteProject(title string) error {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return fmt.Errorf("log in first please")
	}
	return agent.DeleteProject(title)
}

func (a *AgentService) ListChapters(projectName string) ([]database.Chapter, error) {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return nil, fmt.Errorf("log in first please")
	}
	return agent.ListChapters(projectName)
}

func (a *AgentService) AddChapter(projectName string, order uint, title string) error {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return fmt.Errorf("log in first please")
	}
	return agent.AddChapter(projectName, order, title)
}

func (a *AgentService) UpdateChapterTitle(projectName string, order uint, title string) error {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return fmt.Errorf("log in first please")
	}
	return agent.UpdateChapterTitle(projectName, order, title)
}

func (a *AgentService) DeleteChapter(projectName string, order uint) error {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return fmt.Errorf("log in first please")
	}
	return agent.DeleteChapter(projectName, order)
}

func (a *AgentService) UpdateChapterPages(projectName string, chapterOrder uint, pages []string) error {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return fmt.Errorf("log in first please")
	}
	return agent.UpdateChapterPages(projectName, chapterOrder, pages)
}

func (a *AgentService) GetChapterPageMetas(projectName string, chapterOrder uint) ([]comicdb.PageMeta, error) {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return nil, fmt.Errorf("log in first please")
	}
	return agent.GetChapterPageMetas(projectName, chapterOrder)
}

func (a *AgentService) GetChapterTags(projectName string, chapterOrder uint) ([]string, error) {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return nil, fmt.Errorf("log in first please")
	}
	return agent.GetChapterTags(projectName, chapterOrder)
}

func (a *AgentService) SetChapterTags(projectName string, chapterOrder uint, tags []string) error {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return fmt.Errorf("log in first please")
	}
	return agent.SetChapterTags(projectName, chapterOrder, tags)
}

func (a *AgentService) GetGlossary(projectName string) ([]request.GlossaryEntry, error) {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return nil, fmt.Errorf("log in first please")
	}
	return agent.GetGlossary(projectName)
}

func (a *AgentService) UpdateGlossary(projectName string, glossary []request.GlossaryEntry) error {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return fmt.Errorf("log in first please")
	}
	return agent.UpdateGlossary(projectName, glossary)
}

func (a *AgentService) GetTranslators() (map[string]request.Translator, error) {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return nil, fmt.Errorf("log in first please")
	}
	return agent.GetTranslators()
}

func (a *AgentService) UpdateTranslators(translators map[string]request.Translator) error {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return fmt.Errorf("log in first please")
	}
	return agent.UpdateTranslators(translators)
}

func (a *AgentService) ReadChapter(projectName string, chapterOrder uint, force bool) (agents.ChunkInfo, error) {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return agents.ChunkInfo{}, fmt.Errorf("log in first please")
	}
	return agent.ReadChapter(projectName, chapterOrder, force)
}

func (a *AgentService) NextChunk() (agents.ChunkInfo, error) {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return agents.ChunkInfo{}, fmt.Errorf("log in first please")
	}
	return agent.NextChunk()
}

func (a *AgentService) PrevChunk() (agents.ChunkInfo, error) {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return agents.ChunkInfo{}, fmt.Errorf("log in first please")
	}
	return agent.PrevChunk()
}

func (a *AgentService) UpdateOriginalChunk(newDelta *quilldelta.Delta) error {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return fmt.Errorf("log in first please")
	}
	return agent.UpdateOriginalChunk(newDelta)
}

func (a *AgentService) UpdateTranslatedChunk(newDelta *quilldelta.Delta) error {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return fmt.Errorf("log in first please")
	}
	return agent.UpdateTranslatedChunk(newDelta)
}

func (a *AgentService) SaveChapter() error {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return fmt.Errorf("log in first please")
	}
	return agent.SaveChapter()
}

func (a *AgentService) GetChapterMeta() (*meta.ChapterMeta, error) {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return nil, fmt.Errorf("log in first please")
	}
	return agent.GetChapterMeta()
}

func (a *AgentService) SetCurrentChunkTranslated(completed bool) error {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return fmt.Errorf("log in first please")
	}
	return agent.SetCurrentChunkTranslated(completed)
}

func (a *AgentService) SetCurrentChunkReviewed(completed bool) error {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return fmt.Errorf("log in first please")
	}
	return agent.SetCurrentChunkReviewed(completed)
}

func (a *AgentService) GetChapterStatus(projectName string, chapterOrder uint) (meta.ChapterStatus, error) {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return meta.StatusUncompleted, fmt.Errorf("log in first please")
	}
	return agent.GetChapterStatus(projectName, chapterOrder)
}

func (a *AgentService) ExportTranslatedChapter(filePath string) error {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return fmt.Errorf("log in first please")
	}
	return agent.ExportTranslatedChapter(filePath)
}

func (a *AgentService) SetWebExtensionEnabled(enabled bool) error {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return fmt.Errorf("log in first please")
	}
	return agent.SetWebExtensionEnabled(enabled)
}

func (a *AgentService) GetWebExtensionEnabled() (bool, error) {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return false, fmt.Errorf("log in first please")
	}
	return agent.GetWebExtensionEnabled()
}
