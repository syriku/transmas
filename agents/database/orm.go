package database

import (
	"encoding/json"
	"os"
	"path"

	"github.com/syriku/aisdk/request"
	"github.com/syriku/transmas/config"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func ConnectDB() (*gorm.DB, error) {
	cfg := config.GetGlobalConfig()
	err := os.MkdirAll(cfg.AppPath, 0755)
	if err != nil {
		return nil, err
	}
	dbPath := path.Join(cfg.AppPath, "prototype", "manga", "savedata.db")

	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		return nil, err
	}
	err = db.AutoMigrate(&UserData{}, &ProjectInfo{}, &Chapter{})
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

func AddChapter(db *gorm.DB, chapter *Chapter) error {
	return db.Create(chapter).Error
}

func FetchChaptersByProject(db *gorm.DB, projectID uint) ([]Chapter, error) {
	var chapters []Chapter
	err := db.Where(&Chapter{Project: projectID}).Find(&chapters).Error
	return chapters, err
}

func UpdateChapterTitle(db *gorm.DB, projectID uint, order uint, title string) error {
	return db.Model(&Chapter{}).Where(&Chapter{Project: projectID, Order: order}).Update("title", title).Error
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
		// Hard delete all chapters belonging to the project
		if err := tx.Unscoped().Where(&Chapter{Project: project.ID}).Delete(&Chapter{}).Error; err != nil {
			return err
		}
		// Hard delete the project itself
		if err := tx.Unscoped().Delete(&project).Error; err != nil {
			return err
		}
		return nil
	})
}

func DeleteChapter(db *gorm.DB, projectID uint, order uint) error {
	return db.Unscoped().Where(&Chapter{Project: projectID, Order: order}).Delete(&Chapter{}).Error
}
