package novelagents

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/syriku/aisdk/request"
	"github.com/syriku/transmas/agents/meta"
	"github.com/syriku/transmas/agents/novelagents/noveldb"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type NovelAgent interface {
	EnsureProject(title string, workDir string) error
	GetChapter(workDir string, order uint) (noveldb.Chapter, error)
	ListChapters(workDir string) ([]noveldb.Chapter, error)
	AddChapter(workDir string, order uint, title string) error
	UpdateChapterTitle(workDir string, order uint, title string) error
	DeleteChapter(workDir string, order uint) error
	GetChapterStatus(workDir string, order uint) (meta.ChapterStatus, error)
	SaveChapterMeta(workDir string, order uint, m *meta.ChapterMeta) error
	GetGlossary(workDir string) ([]request.GlossaryEntry, error)
	UpdateGlossary(workDir string, glossary []request.GlossaryEntry) error
}

type novelAgentImpl struct {
	db *gorm.DB
}

func NewNovelAgent() NovelAgent {
	return &novelAgentImpl{}
}

func dbPath(dir string) string {
	return filepath.Join(dir, "novel_project")
}

func (n *novelAgentImpl) getDB(workDir string) (*gorm.DB, error) {
	if workDir == "" {
		return nil, fmt.Errorf("empty work directory")
	}
	path := dbPath(workDir)

	// Ensure database directory exists
	err := os.MkdirAll(filepath.Dir(path), 0755)
	if err != nil {
		return nil, fmt.Errorf("failed to create db directory: %w", err)
	}

	db, err := gorm.Open(sqlite.Open(path), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Run migration
	err = db.AutoMigrate(&noveldb.Novel{}, &noveldb.Chapter{}, &noveldb.GlossaryEntry{})
	if err != nil {
		if sqlDB, errClose := db.DB(); errClose == nil {
			sqlDB.Close()
		}
		return nil, fmt.Errorf("failed to auto migrate tables: %w", err)
	}

	return db, nil
}

func (n *novelAgentImpl) EnsureProject(title string, workDir string) error {
	db, err := n.getDB(workDir)
	if err != nil {
		return err
	}
	sqlDB, err := db.DB()
	if err == nil {
		defer sqlDB.Close()
	}

	if n.db != nil {
		if existingSQLDB, errClose := n.db.DB(); errClose == nil {
			existingSQLDB.Close()
		}
	}
	n.db = db

	var count int64
	if err := db.Model(&noveldb.Novel{}).Count(&count).Error; err != nil {
		return fmt.Errorf("failed to check if novel exists: %w", err)
	}

	if count == 0 {
		novel := noveldb.Novel{
			Title:   title,
			WorkDir: workDir,
		}
		if err := db.Create(&novel).Error; err != nil {
			return fmt.Errorf("failed to create novel record: %w", err)
		}
	}

	return nil
}

func (n *novelAgentImpl) GetChapter(workDir string, order uint) (noveldb.Chapter, error) {
	var chapter noveldb.Chapter
	db, err := n.getDB(workDir)
	if err != nil {
		return chapter, err
	}
	sqlDB, err := db.DB()
	if err == nil {
		defer sqlDB.Close()
	}

	err = db.Where("`order` = ?", order).First(&chapter).Error
	return chapter, err
}

func (n *novelAgentImpl) ListChapters(workDir string) ([]noveldb.Chapter, error) {
	db, err := n.getDB(workDir)
	if err != nil {
		return nil, err
	}
	sqlDB, err := db.DB()
	if err == nil {
		defer sqlDB.Close()
	}

	var chapters []noveldb.Chapter
	err = db.Order("`order` ASC").Find(&chapters).Error
	return chapters, err
}

func (n *novelAgentImpl) AddChapter(workDir string, order uint, title string) error {
	db, err := n.getDB(workDir)
	if err != nil {
		return err
	}
	sqlDB, err := db.DB()
	if err == nil {
		defer sqlDB.Close()
	}

	chapter := noveldb.Chapter{
		Order: order,
		Title: title,
	}
	return db.Create(&chapter).Error
}

func (n *novelAgentImpl) UpdateChapterTitle(workDir string, order uint, title string) error {
	db, err := n.getDB(workDir)
	if err != nil {
		return err
	}
	sqlDB, err := db.DB()
	if err == nil {
		defer sqlDB.Close()
	}

	return db.Model(&noveldb.Chapter{}).Where("`order` = ?", order).Update("title", title).Error
}

func (n *novelAgentImpl) DeleteChapter(workDir string, order uint) error {
	db, err := n.getDB(workDir)
	if err != nil {
		return err
	}
	sqlDB, err := db.DB()
	if err == nil {
		defer sqlDB.Close()
	}

	return db.Unscoped().Where("`order` = ?", order).Delete(&noveldb.Chapter{}).Error
}

func (n *novelAgentImpl) GetChapterStatus(workDir string, order uint) (meta.ChapterStatus, error) {
	db, err := n.getDB(workDir)
	if err != nil {
		return meta.StatusUncompleted, err
	}
	sqlDB, err := db.DB()
	if err == nil {
		defer sqlDB.Close()
	}

	var chapter noveldb.Chapter
	err = db.Where("`order` = ?", order).First(&chapter).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return meta.StatusUncompleted, nil
		}
		return meta.StatusUncompleted, err
	}

	m := &meta.ChapterMeta{
		LastChunkCount:   chapter.LastChunkCount,
		TranslatedChunks: chapter.TranslatedChunks,
		ReviewedChunks:   chapter.ReviewedChunks,
	}
	return m.GetStatus(chapter.LastChunkCount), nil
}

func (n *novelAgentImpl) SaveChapterMeta(workDir string, order uint, m *meta.ChapterMeta) error {
	db, err := n.getDB(workDir)
	if err != nil {
		return err
	}
	sqlDB, err := db.DB()
	if err == nil {
		defer sqlDB.Close()
	}

	var chapter noveldb.Chapter
	if err := db.Where("`order` = ?", order).First(&chapter).Error; err != nil {
		return err
	}

	chapter.LastChunkSize = m.LastChunkSize
	chapter.LastChunkCount = m.LastChunkCount
	chapter.TranslatedChunks = m.TranslatedChunks
	chapter.ReviewedChunks = m.ReviewedChunks

	return db.Save(&chapter).Error
}

func (n *novelAgentImpl) GetGlossary(workDir string) ([]request.GlossaryEntry, error) {
	db, err := n.getDB(workDir)
	if err != nil {
		return nil, err
	}
	sqlDB, err := db.DB()
	if err == nil {
		defer sqlDB.Close()
	}

	var dbEntries []noveldb.GlossaryEntry
	err = db.Find(&dbEntries).Error
	if err != nil {
		return nil, err
	}
	return noveldb.FromDB(dbEntries), nil
}

func (n *novelAgentImpl) UpdateGlossary(workDir string, glossary []request.GlossaryEntry) error {
	db, err := n.getDB(workDir)
	if err != nil {
		return err
	}
	sqlDB, err := db.DB()
	if err == nil {
		defer sqlDB.Close()
	}

	return db.Transaction(func(tx *gorm.DB) error {
		err := tx.Unscoped().Where("1 = 1").Delete(&noveldb.GlossaryEntry{}).Error
		if err != nil {
			return err
		}
		if len(glossary) > 0 {
			dbEntries := noveldb.ToDB(glossary)
			err = tx.Create(&dbEntries).Error
			if err != nil {
				return err
			}
		}
		return nil
	})
}
