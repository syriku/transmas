package database

import (
	"github.com/syriku/aisdk/request"
	"gorm.io/gorm"
)

type ProjectType int

const (
	ProjectTypeNovel ProjectType = iota
	ProjectTypeComic
)

type ProjectInfo struct {
	gorm.Model
	Title         string `gorm:"uniqueIndex:idx_project_owner_title"`
	Owner         string `gorm:"uniqueIndex:idx_project_owner_title"`
	WorkDir       string
	Glossary      []request.GlossaryEntry `gorm:"serializer:json"`
	TranslatorKey string
	AiConfigKey   string
	ProjectType   ProjectType `gorm:"not null;default:0"`
}

func UpdateProjectTranslatorKey(db *gorm.DB, owner string, proj string, translatorKey string) error {
	return db.Model(&ProjectInfo{}).Where(&ProjectInfo{Owner: owner, Title: proj}).Update("translator_key", translatorKey).Error
}

func FetchProjectTranslatorKey(db *gorm.DB, owner string, proj string) (string, error) {
	var project ProjectInfo
	err := db.Where(&ProjectInfo{Owner: owner, Title: proj}).First(&project).Error
	return project.TranslatorKey, err
}

func UpdateProjectAiConfigKey(db *gorm.DB, owner string, proj string, aiConfigKey string) error {
	return db.Model(&ProjectInfo{}).Where(&ProjectInfo{Owner: owner, Title: proj}).Update("ai_config_key", aiConfigKey).Error
}

func FetchProjectAiConfigKey(db *gorm.DB, owner string, proj string) (string, error) {
	var project ProjectInfo
	err := db.Where(&ProjectInfo{Owner: owner, Title: proj}).First(&project).Error
	return project.AiConfigKey, err
}
