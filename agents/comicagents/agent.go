package comicagents

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/syriku/label-go/comic"
	"github.com/syriku/transmas/agents/comicagents/comicdb"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// ComicAgent defines the behaviors and operations specific to comic translation and processing.
type ComicAgent interface {
	// TODO: Add comic agent methods here as the features develop.
	EnsureProject(comicInfo comic.WorkComic) error
}

// comicAgentImpl is the concrete implementation of the ComicAgent interface.
type comicAgentImpl struct {
	db *gorm.DB
}

func dbPath(dir string) string {
	return filepath.Join(dir, "comic_project")
}

func (c *comicAgentImpl) EnsureProject(comicInfo comic.WorkComic) error {
	dir := comicInfo.WorkDir
	if dir == "" {
		return fmt.Errorf("not a valid dir in comic")
	}
	dbPath := dbPath(dir)

	// Ensure database directory exists
	err := os.MkdirAll(filepath.Dir(dbPath), 0755)
	if err != nil {
		return fmt.Errorf("failed to create db directory: %w", err)
	}

	// Close existing db if open
	if c.db != nil {
		if sqlDB, err := c.db.DB(); err == nil {
			sqlDB.Close()
		}
	}

	// Connect to database
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	// Run migration
	err = db.AutoMigrate(&comicdb.Comic{}, &comicdb.Chapter{}, &comicdb.Label{})
	if err != nil {
		return fmt.Errorf("failed to auto migrate tables: %w", err)
	}

	c.db = db

	// Check if comic exists in the database
	var count int64
	if err := c.db.Model(&comicdb.Comic{}).Count(&count).Error; err != nil {
		return fmt.Errorf("failed to check if comic exists: %w", err)
	}

	if count == 0 {
		err := c.db.Transaction(func(tx *gorm.DB) error {
			dbComic := comicdb.Comic{
				Title:    comicInfo.Title,
				Chapters: uint(len(comicInfo.Chapters)),
				WorkDir:  comicInfo.WorkDir,
			}
			if err := tx.Create(&dbComic).Error; err != nil {
				return err
			}

			for _, ch := range comicInfo.Chapters {
				var dbPages []comicdb.PageMeta
				for _, p := range ch.Pages {
					dbPages = append(dbPages, comicdb.PageMeta{
						FileName: p.FileName,
						Format:   p.Format,
						Size:     p.Size,
					})
				}

				dbChapter := comicdb.Chapter{
					ComicID:   dbComic.ID,
					Title:     ch.Title,
					Order:     ch.Order,
					DirName:   ch.DirName,
					PageCount: ch.PageCount,
					Pages:     dbPages,
					Tags:      ch.Tags,
				}
				if err := tx.Create(&dbChapter).Error; err != nil {
					return err
				}

				for _, l := range ch.Labels {
					dbLabel := comicdb.Label{
						ChapterID:  dbChapter.ID,
						PosX:       l.Pos[0],
						PosY:       l.Pos[1],
						Tag:        l.Tag,
						Text:       l.Text,
						Translated: l.Translated,
						Reviewed:   l.Reviewed,
						Page:       l.Page,
					}
					if err := tx.Create(&dbLabel).Error; err != nil {
						return err
					}
				}
			}
			return nil
		})
		if err != nil {
			return fmt.Errorf("failed to populate initial comic data: %w", err)
		}
	}

	return nil
}

// NewComicAgent creates and returns a new instance of ComicAgent.
func NewComicAgent() ComicAgent {
	return new(comicAgentImpl)
}
