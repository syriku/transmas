package comicagents

import (
	"errors"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"os"
	"path/filepath"
	"strings"

	"github.com/syriku/label-go/comic"
	"github.com/syriku/transmas/agents/comicagents/comicdb"
	"github.com/syriku/transmas/agents/meta"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// ComicAgent defines the behaviors and operations specific to comic translation and processing.
type ComicAgent interface {
	EnsureProject(comicInfo comic.WorkComic) error
	ListChapters(workDir string) ([]comicdb.Chapter, error)
	AddChapter(workDir string, order uint, title string) error
	UpdateChapterTitle(workDir string, order uint, title string) error
	DeleteChapter(workDir string, order uint) error
	GetChapterStatus(workDir string, order uint) (meta.ChapterStatus, error)
	UpdateChapterPages(workDir string, order uint, pages []string) error
	GetChapterPageMetas(workDir string, order uint) ([]comicdb.PageMeta, error)
}

// comicAgentImpl is the concrete implementation of the ComicAgent interface.
type comicAgentImpl struct {
	db *gorm.DB
}

func dbPath(dir string) string {
	return filepath.Join(dir, "comic_project")
}

func (c *comicAgentImpl) getDB(workDir string) (*gorm.DB, error) {
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
	err = db.AutoMigrate(&comicdb.Comic{}, &comicdb.Chapter{}, &comicdb.Label{}, &comicdb.PageMeta{})
	if err != nil {
		if sqlDB, errClose := db.DB(); errClose == nil {
			sqlDB.Close()
		}
		return nil, fmt.Errorf("failed to auto migrate tables: %w", err)
	}

	return db, nil
}

func (c *comicAgentImpl) EnsureProject(comicInfo comic.WorkComic) error {
	dir := comicInfo.WorkDir
	db, err := c.getDB(dir)
	if err != nil {
		return err
	}
	sqlDB, err := db.DB()
	if err == nil {
		defer sqlDB.Close()
	}

	// Close existing db if open
	if c.db != nil {
		if existingSQLDB, errClose := c.db.DB(); errClose == nil {
			existingSQLDB.Close()
		}
	}
	c.db = db

	// Check if comic exists in the database
	var count int64
	if err := db.Model(&comicdb.Comic{}).Count(&count).Error; err != nil {
		return fmt.Errorf("failed to check if comic exists: %w", err)
	}

	if count == 0 {
		err := db.Transaction(func(tx *gorm.DB) error {
			dbComic := comicdb.Comic{
				Title:    comicInfo.Title,
				Chapters: uint(len(comicInfo.Chapters)),
				WorkDir:  comicInfo.WorkDir,
			}
			if err := tx.Create(&dbComic).Error; err != nil {
				return err
			}

			for _, ch := range comicInfo.Chapters {
				var pageNames []string
				for _, p := range ch.Pages {
					pageNames = append(pageNames, p.FileName)
				}

				dbChapter := comicdb.Chapter{
					Title:     ch.Title,
					Order:     ch.Order,
					DirName:   ch.DirName,
					PageCount: ch.PageCount,
					Pages:     pageNames,
					Tags:      ch.Tags,
				}
				if err := tx.Create(&dbChapter).Error; err != nil {
					return err
				}

				for _, p := range ch.Pages {
					dbPageMeta := comicdb.PageMeta{
						ChapterID: dbChapter.ID,
						FileName:  p.FileName,
						Format:    p.Format,
						Size:      p.Size,
					}
					if err := tx.Create(&dbPageMeta).Error; err != nil {
						return err
					}
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

func (c *comicAgentImpl) ListChapters(workDir string) ([]comicdb.Chapter, error) {
	db, err := c.getDB(workDir)
	if err != nil {
		return nil, err
	}
	sqlDB, err := db.DB()
	if err == nil {
		defer sqlDB.Close()
	}

	var chapters []comicdb.Chapter
	err = db.Order("`order` ASC").Find(&chapters).Error
	return chapters, err
}

func (c *comicAgentImpl) AddChapter(workDir string, order uint, title string) error {
	db, err := c.getDB(workDir)
	if err != nil {
		return err
	}
	sqlDB, err := db.DB()
	if err == nil {
		defer sqlDB.Close()
	}

	var com comicdb.Comic
	if err := db.First(&com).Error; err != nil {
		return fmt.Errorf("failed to find comic in project db: %w", err)
	}

	chapter := comicdb.Chapter{
		Title:   title,
		Order:   order,
		DirName: title,
		Pages:   []string{},
		Tags:    []string{},
	}
	return db.Create(&chapter).Error
}

func (c *comicAgentImpl) UpdateChapterTitle(workDir string, order uint, title string) error {
	db, err := c.getDB(workDir)
	if err != nil {
		return err
	}
	sqlDB, err := db.DB()
	if err == nil {
		defer sqlDB.Close()
	}

	return db.Model(&comicdb.Chapter{}).Where("`order` = ?", order).Update("title", title).Error
}

func (c *comicAgentImpl) DeleteChapter(workDir string, order uint) error {
	db, err := c.getDB(workDir)
	if err != nil {
		return err
	}
	sqlDB, err := db.DB()
	if err == nil {
		defer sqlDB.Close()
	}

	var ch comicdb.Chapter
	if err := db.Where("`order` = ?", order).First(&ch).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return err
	}

	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("chapter_id = ?", ch.ID).Delete(&comicdb.Label{}).Error; err != nil {
			return err
		}
		if err := tx.Delete(&ch).Error; err != nil {
			return err
		}
		return nil
	})
}

func (c *comicAgentImpl) GetChapterStatus(workDir string, order uint) (meta.ChapterStatus, error) {
	db, err := c.getDB(workDir)
	if err != nil {
		return meta.StatusUncompleted, err
	}
	sqlDB, err := db.DB()
	if err == nil {
		defer sqlDB.Close()
	}

	var ch comicdb.Chapter
	if err := db.Where("`order` = ?", order).First(&ch).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return meta.StatusUncompleted, nil
		}
		return meta.StatusUncompleted, err
	}

	var labels []comicdb.Label
	if err := db.Where("chapter_id = ?", ch.ID).Find(&labels).Error; err != nil {
		return meta.StatusUncompleted, err
	}

	if len(labels) == 0 {
		return meta.StatusUncompleted, nil
	}

	allReviewed := true
	allTranslated := true
	for _, l := range labels {
		if !l.Reviewed {
			allReviewed = false
		}
		if !l.Translated {
			allTranslated = false
		}
	}

	if allReviewed {
		return meta.StatusReviewed, nil
	}
	if allTranslated {
		return meta.StatusTranslated, nil
	}
	return meta.StatusUncompleted, nil
}

func (c *comicAgentImpl) UpdateChapterPages(workDir string, order uint, pages []string) error {
	db, err := c.getDB(workDir)
	if err != nil {
		return err
	}
	sqlDB, err := db.DB()
	if err == nil {
		defer sqlDB.Close()
	}

	var ch comicdb.Chapter
	if err := db.Where("`order` = ?", order).First(&ch).Error; err != nil {
		return err
	}

	var com comicdb.Comic
	if err := db.First(&com).Error; err != nil {
		return err
	}

	return db.Transaction(func(tx *gorm.DB) error {
		for _, filename := range pages {
			var count int64
			err := tx.Model(&comicdb.PageMeta{}).
				Where("chapter_id = ? AND file_name = ?", ch.ID, filename).
				Count(&count).Error
			if err != nil {
				return err
			}

			if count == 0 {
				format := comic.JPG
				if strings.ToLower(filepath.Ext(filename)) == ".png" {
					format = comic.PNG
				}
				size := [2]uint{0, 0}

				filePath := filepath.Join(workDir, ch.DirName, filename)
				if f, err := os.Open(filePath); err == nil {
					if cfg, _, err := image.DecodeConfig(f); err == nil {
						size = [2]uint{uint(cfg.Width), uint(cfg.Height)}
					}
					f.Close()
				}

				dbPageMeta := comicdb.PageMeta{
					ChapterID: ch.ID,
					FileName:  filename,
					Format:    format,
					Size:      size,
				}
				if err := tx.Create(&dbPageMeta).Error; err != nil {
					return err
				}
			}
		}

		ch.Pages = pages
		ch.PageCount = uint(len(pages))
		if err := tx.Save(&ch).Error; err != nil {
			return err
		}

		return nil
	})
}

func (c *comicAgentImpl) GetChapterPageMetas(workDir string, order uint) ([]comicdb.PageMeta, error) {
	db, err := c.getDB(workDir)
	if err != nil {
		return nil, err
	}
	sqlDB, err := db.DB()
	if err == nil {
		defer sqlDB.Close()
	}

	var ch comicdb.Chapter
	if err := db.Where("`order` = ?", order).First(&ch).Error; err != nil {
		return nil, err
	}

	var metas []comicdb.PageMeta
	if err := db.Where("chapter_id = ?", ch.ID).Find(&metas).Error; err != nil {
		return nil, err
	}

	metaMap := make(map[string]comicdb.PageMeta)
	for _, m := range metas {
		metaMap[m.FileName] = m
	}

	result := make([]comicdb.PageMeta, 0, len(ch.Pages))
	for _, filename := range ch.Pages {
		if m, exists := metaMap[filename]; exists {
			result = append(result, m)
		} else {
			format := comic.JPG
			if strings.ToLower(filepath.Ext(filename)) == ".png" {
				format = comic.PNG
			}
			result = append(result, comicdb.PageMeta{
				ChapterID: ch.ID,
				FileName:  filename,
				Format:    format,
				Size:      [2]uint{0, 0},
			})
		}
	}

	return result, nil
}

// NewComicAgent creates and returns a new instance of ComicAgent.
func NewComicAgent() ComicAgent {
	return new(comicAgentImpl)
}
