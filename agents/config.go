package agents

import (
	"fmt"

	"github.com/syriku/aisdk/api"
	"github.com/syriku/aisdk/request"
	"github.com/syriku/transmas/agents/database"
)

type ConfigAgent interface {
	GetAiConfig() (map[string]api.UserConfig, error)
	UpdateAiConfig(map[string]api.UserConfig) error
	GetTranslators() (map[string]request.Translator, error)
	UpdateTranslators(map[string]request.Translator) error
	GetProjectAiConfigKey(projectName string) (string, error)
	UpdateProjectAiConfigKey(projectName string, configKey string) error
	GetProjectTranslatorKey(projectName string) (string, error)
	UpdateProjectTranslatorKey(projectName string, translatorKey string) error
	GetAiConfigByKey(key string) (api.UserConfig, error)
	GetTranslatorByKey(key string) (request.Translator, error)
}

func (i *translateAgentImpl) GetAiConfig() (map[string]api.UserConfig, error) {
	return database.FetchUserAiConfig(i.db, i.userData.Username)
}

func (i *translateAgentImpl) UpdateAiConfig(aiConfig map[string]api.UserConfig) error {
	err := database.UpdateUserAiConfig(i.db, i.userData.Username, aiConfig)
	if err != nil {
		return err
	}
	i.userData.AiConfig = aiConfig
	return nil
}

func (i *translateAgentImpl) GetTranslators() (map[string]request.Translator, error) {
	return database.FetchUserTranslators(i.db, i.userData.Username)
}

func (i *translateAgentImpl) UpdateTranslators(translators map[string]request.Translator) error {
	err := database.UpdateUserTranslators(i.db, i.userData.Username, translators)
	if err != nil {
		return err
	}
	i.userData.Translators = translators
	return nil
}

func (i *translateAgentImpl) GetProjectAiConfigKey(projectName string) (string, error) {
	return database.FetchProjectAiConfigKey(i.db, i.userData.Username, projectName)
}

func (i *translateAgentImpl) UpdateProjectAiConfigKey(projectName string, configKey string) error {
	return database.UpdateProjectAiConfigKey(i.db, i.userData.Username, projectName, configKey)
}

func (i *translateAgentImpl) GetProjectTranslatorKey(projectName string) (string, error) {
	return database.FetchProjectTranslatorKey(i.db, i.userData.Username, projectName)
}

func (i *translateAgentImpl) UpdateProjectTranslatorKey(projectName string, translatorKey string) error {
	return database.UpdateProjectTranslatorKey(i.db, i.userData.Username, projectName, translatorKey)
}

func (i *translateAgentImpl) GetAiConfigByKey(key string) (api.UserConfig, error) {
	config, ok := i.userData.AiConfig[key]
	if !ok {
		return api.UserConfig{}, fmt.Errorf("config not found for key: %s", key)
	}
	return config, nil
}

func (i *translateAgentImpl) GetTranslatorByKey(key string) (request.Translator, error) {
	translator, ok := i.userData.Translators[key]
	if !ok {
		return request.Translator{}, fmt.Errorf("translator not found for key: %s", key)
	}
	return translator, nil
}
