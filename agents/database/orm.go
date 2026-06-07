package database

import (
	"encoding/json"
	"os"

	"github.com/syriku/aisdk/request"
	"github.com/syriku/transmas/config"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func ConnectDB() (*gorm.DB, error) {
	cfg := config.GetGlobalConfig()
	err := os.MkdirAll(cfg.AppPath, 0o755)
	if err != nil {
		return nil, err
	}

	db, err := gorm.Open(sqlite.Open(config.GetDBPath()), &gorm.Config{})
	if err != nil {
		return nil, err
	}
	err = db.AutoMigrate(&UserData{}, &ProjectInfo{})
	if err != nil {
		return nil, err
	}
	return db, nil
}

func AddProject(db *gorm.DB, project *ProjectInfo) error {
	return db.Create(project).Error
}

func FetchProjectsByOwner(db *gorm.DB, owner string) ([]ProjectInfo, error) {
	var projects []ProjectInfo
	err := db.Where(&ProjectInfo{Owner: owner}).Find(&projects).Error
	return projects, err
}

func FetchProjectByOwnerAndTitle(db *gorm.DB, owner string, title string) (ProjectInfo, error) {
	var project ProjectInfo
	err := db.Where(&ProjectInfo{Owner: owner, Title: title}).First(&project).Error
	return project, err
}

func UpdateProjectDir(db *gorm.DB, owner string, proj string, dir string) error {
	return db.Model(&ProjectInfo{}).Where(&ProjectInfo{Owner: owner, Title: proj}).Update("work_dir", dir).Error
}

func RenameProject(db *gorm.DB, owner string, oldTitle string, newTitle string) error {
	return db.Model(&ProjectInfo{}).Where(&ProjectInfo{Owner: owner, Title: oldTitle}).Update("title", newTitle).Error
}

func UpdateProjectGlossary(db *gorm.DB, owner string, proj string, glossary []request.GlossaryEntry) error {
	data, err := json.Marshal(glossary)
	if err != nil {
		return err
	}
	return db.Model(&ProjectInfo{}).Where(&ProjectInfo{Owner: owner, Title: proj}).Update("glossary", string(data)).Error
}

func FetchProjectGlossary(db *gorm.DB, owner string, proj string) ([]request.GlossaryEntry, error) {
	var project ProjectInfo
	err := db.Where(&ProjectInfo{Owner: owner, Title: proj}).First(&project).Error
	return project.Glossary, err
}

func DeleteProject(db *gorm.DB, owner string, title string) error {
	var project ProjectInfo
	if err := db.Where(&ProjectInfo{Owner: owner, Title: title}).First(&project).Error; err != nil {
		return err
	}
	return db.Transaction(func(tx *gorm.DB) error {
		// Hard delete the project itself
		if err := tx.Unscoped().Delete(&project).Error; err != nil {
			return err
		}
		return nil
	})
}
