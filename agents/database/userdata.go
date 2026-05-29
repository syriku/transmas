package database

import (
	"encoding/json"
	"log"

	"github.com/syriku/aisdk/api"
	"github.com/syriku/aisdk/request"
	"gorm.io/gorm"
)

type UserData struct {
	gorm.Model
	Username            string                        `gorm:"uniqueIndex"`
	AiConfig            map[string]api.UserConfig     `gorm:"serializer:json"`
	Translators         map[string]request.Translator `gorm:"serializer:json"`
	WebExtensionEnabled bool
}

func NewUserData(username string) UserData {
	return UserData{
		Username:            username,
		AiConfig:            map[string]api.UserConfig{},
		Translators:         map[string]request.Translator{},
		WebExtensionEnabled: false,
	}
}

func AddUserData(db *gorm.DB, userdata *UserData) error {
	return db.Create(userdata).Error
}

func FetchUserData(db *gorm.DB, username string, oUserData *UserData) error {
	err := db.Where(&UserData{Username: username}).First(oUserData).Error
	if err != nil {
		return err
	}
	log.Printf("got data of username: %s", username)
	return nil
}

func DelUserData(db *gorm.DB, userdata *UserData) error {
	return db.Delete(userdata).Error
}

func UpdateUserAiConfig(db *gorm.DB, username string, aiConfig map[string]api.UserConfig) error {
	data, err := json.Marshal(aiConfig)
	if err != nil {
		return err
	}
	return db.Model(&UserData{}).Where(&UserData{Username: username}).Update("ai_config", string(data)).Error
}

func UpdateUserTranslators(db *gorm.DB, username string, translators map[string]request.Translator) error {
	data, err := json.Marshal(translators)
	if err != nil {
		return err
	}
	return db.Model(&UserData{}).Where(&UserData{Username: username}).Update("translators", string(data)).Error
}

func UpdateUserWebExtensionEnabled(db *gorm.DB, username string, enabled bool) error {
	return db.Model(&UserData{}).Where(&UserData{Username: username}).Update("web_extension_enabled", enabled).Error
}

func FetchUserTranslators(db *gorm.DB, username string) (map[string]request.Translator, error) {
	var userData UserData
	err := db.Where(&UserData{Username: username}).First(&userData).Error
	return userData.Translators, err
}

func FetchUserAiConfig(db *gorm.DB, username string) (map[string]api.UserConfig, error) {
	var userData UserData
	err := db.Where(&UserData{Username: username}).First(&userData).Error
	return userData.AiConfig, err
}
