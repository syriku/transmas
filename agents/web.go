package agents

import (
	"github.com/syriku/transmas/agents/database"
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

	// Stub start server logic
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

	// Stub stop server logic
	i.userData.WebExtensionEnabled = false
	i.serverRunning = false
	return nil
}

func emitWebServerError(err string) {
	if app := application.Get(); app != nil && app.Event != nil {
		app.Event.Emit(WebServerErrorEventName, err)
	}
}
