package service

import (
	"fmt"

	"github.com/syriku/transmas/agents"
)

func (a *AgentService) GetProjectAiConfigKey(projectName string) (string, error) {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return "", fmt.Errorf("log in first please")
	}
	return agent.GetProjectAiConfigKey(projectName)
}

func (a *AgentService) UpdateProjectAiConfigKey(projectName string, configKey string) error {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return fmt.Errorf("log in first please")
	}
	return agent.UpdateProjectAiConfigKey(projectName, configKey)
}

func (a *AgentService) GetProjectTranslatorKey(projectName string) (string, error) {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return "", fmt.Errorf("log in first please")
	}
	return agent.GetProjectTranslatorKey(projectName)
}

func (a *AgentService) UpdateProjectTranslatorKey(projectName string, translatorKey string) error {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return fmt.Errorf("log in first please")
	}
	return agent.UpdateProjectTranslatorKey(projectName, translatorKey)
}

func (a *AgentService) CreateReusableTranslator(projectName string, model string) (uintptr, error) {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return 0, fmt.Errorf("log in first please")
	}
	return agent.CreateReusableTranslator(projectName, model)
}

func (a *AgentService) DestroyReusableTranslator(handle uintptr) error {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return fmt.Errorf("log in first please")
	}
	return agent.DestroyReusableTranslator(handle)
}

func (a *AgentService) TranslateWithHandle(handle uintptr, detailed bool) (agents.TranslationResponse, error) {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return agents.TranslationResponse{}, fmt.Errorf("log in first please")
	}
	return agent.TranslateWithHandle(handle, detailed)
}

func (a *AgentService) TranslateWithParams(projectName string, model string, detailed bool) (agents.TranslationResponse, error) {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return agents.TranslationResponse{}, fmt.Errorf("log in first please")
	}
	return agent.TranslateWithParams(projectName, model, detailed)
}

func (a *AgentService) GetTranslationEventName() (string, error) {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return "", fmt.Errorf("log in first please")
	}
	return agent.GetTranslationEventName(), nil
}

func (a *AgentService) CancelTranslation(handle string) error {
	a.mu.RLock()
	agent := a.agent
	a.mu.RUnlock()

	if agent == nil {
		return fmt.Errorf("log in first please")
	}
	return agent.CancelTranslation(handle)
}
