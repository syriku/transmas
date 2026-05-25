package service

import (
	"fmt"
	"sync"

	"github.com/syriku/aisdk/api"
	"github.com/syriku/aisdk/request"
	"github.com/syriku/quill-delta/quilldelta"
	"github.com/syriku/transmas/agents"
	"github.com/syriku/transmas/agents/database"
	"github.com/syriku/transmas/agents/meta"
	"gorm.io/gorm"
)

type AgentService struct {
	db    *gorm.DB
	agent agents.TranslateAgent
	mu    sync.RWMutex
}

func NewAgentService(db *gorm.DB) *AgentService {
	return &AgentService{
		db: db,
	}
}

func (a *AgentService) LogIn(username string) error {
	agent, err := agents.NewTranslateAgent(a.db, username)
	if err != nil {
		return err
	}

	a.mu.Lock()
	a.agent = agent
	a.mu.Unlock()
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

func (a *AgentService) AddProject(title string) error {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return fmt.Errorf("log in first please")
	}
	return agent.AddProject(title)
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
