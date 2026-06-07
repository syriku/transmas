package agents

import (
	"log"

	"github.com/syriku/transmas/agents/database"
	"github.com/syriku/transmas/server"
	"github.com/wailsapp/wails/v3/pkg/application"
)

const WebServerErrorEventName = "web-server-error"

type WebAgent interface {
	SetWebExtensionEnabled(enabled bool) error
	GetWebExtensionEnabled() (bool, error)
}

func (i *translateAgentImpl) SetWebExtensionEnabled(enabled bool) error {
	i.webMu.Lock()
	if i.userData.WebExtensionEnabled == enabled {
		i.webMu.Unlock()
		return nil
	}
	i.webMu.Unlock()

	err := database.UpdateUserWebExtensionEnabled(i.db, i.userData.Username, enabled)
	if err != nil {
		return err
	}

	if enabled {
		return i.startServer()
	} else {
		return i.stopServer()
	}
}

func (i *translateAgentImpl) GetWebExtensionEnabled() (bool, error) {
	i.webMu.Lock()
	defer i.webMu.Unlock()
	return i.userData.WebExtensionEnabled, nil
}

func (i *translateAgentImpl) startServer() error {
	i.webMu.Lock()
	defer i.webMu.Unlock()
	if i.serverRunning {
		return nil
	}

	factory := server.NewClientFactory()
	srv, err := factory.Create(server.ServerConfig{
		Port:     45123,
		Username: i.userData.Username,
		ListProjects: func() ([]server.ProjectInfo, error) {
			projects, err := i.ListProjects()
			if err != nil {
				return nil, err
			}
			result := make([]server.ProjectInfo, len(projects))
			for idx, p := range projects {
				result[idx] = server.ProjectInfo{
					Title:   p.Title,
					WorkDir: p.WorkDir,
				}
			}
			return result, nil
		},
		GetProjectWorkDir: func(projectName string) (string, error) {
			proj, err := database.FetchProjectByOwnerAndTitle(i.db, i.userData.Username, projectName)
			if err != nil {
				return "", err
			}
			return proj.WorkDir, nil
		},
		GetNextChapterOrder: func(projectName string) (uint, error) {
			chapters, err := i.ListChapters(projectName)
			if err != nil {
				return 0, err
			}
			nextOrder := uint(1)
			if len(chapters) > 0 {
				maxVal := uint(0)
				for _, c := range chapters {
					if c.Order > maxVal {
						maxVal = c.Order
					}
				}
				nextOrder = maxVal + 1
			}
			return nextOrder, nil
		},
		AddChapter: func(projectName string, order uint, title string) error {
			return i.AddChapter(projectName, order, title)
		},
	})
	if err != nil {
		return err
	}

	i.webServer = srv
	i.userData.WebExtensionEnabled = true
	i.serverRunning = true
	return nil
}

func (i *translateAgentImpl) stopServer() error {
	i.webMu.Lock()
	defer i.webMu.Unlock()
	if !i.serverRunning {
		return nil
	}

	if i.webServer != nil {
		if err := i.webServer.Dispose(); err != nil {
			log.Printf("failed to stop web helper server: %v", err)
		}
		i.webServer = nil
	}

	i.userData.WebExtensionEnabled = false
	i.serverRunning = false
	return nil
}

func emitWebServerError(err string) {
	if app := application.Get(); app != nil && app.Event != nil {
		app.Event.Emit(WebServerErrorEventName, err)
	}
}
