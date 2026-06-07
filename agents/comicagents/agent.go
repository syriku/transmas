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
	"github.com/syriku/label-go/label"
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
	GetChapterTags(workDir string, order uint) ([]string, error)
	SetChapterTags(workDir string, order uint, tags []string) error
	UpdatePageLabels(workDir string, order uint, filename string, labels label.Labels) error
	MergeLabels(workDir string, order uint) (label.Labels, error)
	ExportLp(workDir string, order uint, filePath string) error
	ImportLp(workDir string, order uint, filePath string) error
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
	err = db.AutoMigrate(&comicdb.Comic{}, &comicdb.Chapter{}, &comicdb.PageMeta{})
	if err != nil {
		if sqlDB, errClose := db.DB(); errClose == nil {
			sqlDB.Close()
		}
		return nil, fmt.Errorf("failed to auto migrate tables: %w", err)
	}

	// Clean up any existing soft-deleted records to resolve historical duplicates
	if err := db.Unscoped().Where("deleted_at IS NOT NULL").Delete(&comicdb.Chapter{}).Error; err != nil {
		if sqlDB, errClose := db.DB(); errClose == nil {
			sqlDB.Close()
		}
		return nil, fmt.Errorf("failed to clean up soft-deleted chapters: %w", err)
	}
	if err := db.Unscoped().Where("deleted_at IS NOT NULL").Delete(&comicdb.PageMeta{}).Error; err != nil {
		if sqlDB, errClose := db.DB(); errClose == nil {
			sqlDB.Close()
		}
		return nil, fmt.Errorf("failed to clean up soft-deleted page metas: %w", err)
	}
	if err := db.Unscoped().Where("deleted_at IS NOT NULL").Delete(&comicdb.Comic{}).Error; err != nil {
		if sqlDB, errClose := db.DB(); errClose == nil {
			sqlDB.Close()
		}
		return nil, fmt.Errorf("failed to clean up soft-deleted comics: %w", err)
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
				pageNames := make([]string, len(ch.Pages))
				for idx, p := range ch.Pages {
					pageNames[idx] = p.FileName
				}

				tags := ch.Tags
				if len(tags) == 0 {
					tags = defaultTagPreset[:]
				}

				dbChapter := comicdb.Chapter{
					Title:     ch.Title,
					Order:     ch.Order,
					DirName:   ch.DirName,
					PageCount: ch.PageCount,
					Pages:     pageNames,
					Tags:      tags,
				}
				if err := tx.Create(&dbChapter).Error; err != nil {
					return err
				}

				activeTagsCount := len(tags)
				labelsByPage := make(map[string]label.Labels)
				for _, l := range ch.Labels {
					if l.Page != "" {
						if l.Tag <= 0 || l.Tag > activeTagsCount {
							l.Tag = 1
						}
						if strings.TrimSpace(l.Text) != "" {
							l.Translated = true
						}
						labelsByPage[l.Page] = append(labelsByPage[l.Page], l)
					}
				}

				for _, p := range ch.Pages {
					dbPageMeta := comicdb.PageMeta{
						ChapterID: dbChapter.ID,
						FileName:  p.FileName,
						Format:    p.Format,
						Size:      p.Size,
						Labels:    labelsByPage[p.FileName],
					}
					if err := tx.Create(&dbPageMeta).Error; err != nil {
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
		Tags:    defaultTagPreset[:],
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
		if err := tx.Unscoped().Where("chapter_id = ?", ch.ID).Delete(&comicdb.PageMeta{}).Error; err != nil {
			return err
		}
		if err := tx.Unscoped().Delete(&ch).Error; err != nil {
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

	var metas []comicdb.PageMeta
	if err := db.Where("chapter_id = ?", ch.ID).Find(&metas).Error; err != nil {
		return meta.StatusUncompleted, err
	}

	totalLabels := 0
	allReviewed := true
	allTranslated := true
	for _, pm := range metas {
		for _, l := range pm.Labels {
			totalLabels++
			if !l.Reviewed {
				allReviewed = false
			}
			if !l.Translated {
				allTranslated = false
			}
		}
	}

	if totalLabels == 0 {
		return meta.StatusUncompleted, nil
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

func (c *comicAgentImpl) GetChapterTags(workDir string, order uint) ([]string, error) {
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

	if len(ch.Tags) == 0 {
		defaultTags := defaultTagPreset[:]
		ch.Tags = defaultTags
		if err := db.Save(&ch).Error; err != nil {
			return nil, err
		}
		return defaultTags, nil
	}

	return ch.Tags, nil
}

func (c *comicAgentImpl) SetChapterTags(workDir string, order uint, tags []string) error {
	cleaned := make([]string, 0, len(tags))
	seen := make(map[string]bool)
	for _, tag := range tags {
		trimmed := strings.TrimSpace(tag)
		if trimmed == "" {
			continue
		}
		if !seen[trimmed] {
			seen[trimmed] = true
			cleaned = append(cleaned, trimmed)
		}
	}

	if len(cleaned) == 0 {
		return fmt.Errorf("tags cannot be empty, at least one non-empty unique tag is required")
	}

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

	return db.Transaction(func(tx *gorm.DB) error {
		ch.Tags = cleaned
		if err := tx.Save(&ch).Error; err != nil {
			return err
		}

		var pageMetas []comicdb.PageMeta
		if err := tx.Where("chapter_id = ?", ch.ID).Find(&pageMetas).Error; err != nil {
			return err
		}

		newLimit := len(cleaned)
		for _, pm := range pageMetas {
			modified := false
			for idx := range pm.Labels {
				if pm.Labels[idx].Tag <= 0 || pm.Labels[idx].Tag > newLimit {
					pm.Labels[idx].Tag = 1
					modified = true
				}
			}
			if modified {
				if err := tx.Save(&pm).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
}

func (c *comicAgentImpl) UpdatePageLabels(workDir string, order uint, filename string, labels label.Labels) error {
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

	var metas []comicdb.PageMeta
	err = db.Where("chapter_id = ? AND file_name = ?", ch.ID, filename).Limit(1).Find(&metas).Error
	if err != nil {
		return err
	}

	activeTagsCount := len(ch.Tags)
	if activeTagsCount == 0 {
		activeTagsCount = len(defaultTagPreset)
	}
	for idx := range labels {
		if labels[idx].Tag <= 0 || labels[idx].Tag > activeTagsCount {
			labels[idx].Tag = 1
		}
	}

	if len(metas) == 0 {
		format := comic.JPG
		if strings.ToLower(filepath.Ext(filename)) == ".png" {
			format = comic.PNG
		}
		pm := comicdb.PageMeta{
			ChapterID: ch.ID,
			FileName:  filename,
			Format:    format,
			Size:      [2]uint{0, 0},
			Labels:    labels,
		}
		return db.Create(&pm).Error
	}

	pm := metas[0]
	pm.Labels = labels
	return db.Save(&pm).Error
}

func (c *comicAgentImpl) MergeLabels(workDir string, order uint) (label.Labels, error) {
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

	var allLabels label.Labels
	for _, filename := range ch.Pages {
		if m, exists := metaMap[filename]; exists {
			for _, l := range m.Labels {
				l.Page = filename
				allLabels = append(allLabels, l)
			}
		}
	}

	return allLabels, nil
}

func (c *comicAgentImpl) ExportLp(workDir string, order uint, filePath string) error {
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

	var metas []comicdb.PageMeta
	if err := db.Where("chapter_id = ?", ch.ID).Find(&metas).Error; err != nil {
		return err
	}

	metaMap := make(map[string]comicdb.PageMeta)
	for _, m := range metas {
		metaMap[m.FileName] = m
	}

	var pages []comic.PageMeta
	var allLabels label.Labels
	for _, filename := range ch.Pages {
		m, exists := metaMap[filename]
		var size [2]uint
		var format comic.ImageFormat
		if exists {
			size = m.Size
			format = m.Format
			for _, l := range m.Labels {
				l.Page = filename
				allLabels = append(allLabels, l)
			}
		} else {
			format = comic.JPG
			if strings.ToLower(filepath.Ext(filename)) == ".png" {
				format = comic.PNG
			}
		}
		pages = append(pages, comic.PageMeta{
			FileName: filename,
			Format:   format,
			Size:     size,
		})
	}

	wc := comic.WorkChapter{
		Chapter: comic.Chapter{
			Title:     ch.Title,
			Order:     ch.Order,
			PageCount: ch.PageCount,
		},
		DirName: ch.DirName,
		Pages:   pages,
		Labels:  allLabels,
		Tags:    ch.Tags,
	}

	lpStr, err := wc.ExportLp()
	if err != nil {
		return err
	}

	return os.WriteFile(filePath, []byte(lpStr), 0644)
}

func (c *comicAgentImpl) ImportLp(workDir string, order uint, filePath string) error {
	contentBytes, err := os.ReadFile(filePath)
	if err != nil {
		return err
	}
	lpContent := string(contentBytes)

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

	var wc comic.WorkChapter
	var metas []comicdb.PageMeta
	if err := db.Where("chapter_id = ?", ch.ID).Find(&metas).Error; err == nil {
		for _, m := range metas {
			wc.Pages = append(wc.Pages, comic.PageMeta{
				FileName: m.FileName,
				Format:   m.Format,
				Size:     m.Size,
			})
		}
	}

	if err := wc.ParseLp(lpContent); err != nil {
		return err
	}

	activeTagsCount := len(ch.Tags)
	if len(wc.Tags) > 0 {
		activeTagsCount = len(wc.Tags)
	}
	if activeTagsCount == 0 {
		activeTagsCount = len(defaultTagPreset)
	}

	labelsByPage := make(map[string]label.Labels)
	for _, l := range wc.Labels {
		if l.Page != "" {
			if l.Tag <= 0 || l.Tag > activeTagsCount {
				l.Tag = 1
			}
			if strings.TrimSpace(l.Text) != "" {
				l.Translated = true
			}
			labelsByPage[l.Page] = append(labelsByPage[l.Page], l)
		}
	}

	return db.Transaction(func(tx *gorm.DB) error {
		if len(wc.Tags) > 0 {
			ch.Tags = wc.Tags
		}

		if len(wc.Pages) > 0 {
			pageNames := make([]string, len(wc.Pages))
			for idx, p := range wc.Pages {
				pageNames[idx] = p.FileName
			}
			ch.Pages = pageNames
			ch.PageCount = uint(len(pageNames))
		}

		if err := tx.Save(&ch).Error; err != nil {
			return err
		}

		for _, filename := range ch.Pages {
			var metas []comicdb.PageMeta
			err := tx.Where("chapter_id = ? AND file_name = ?", ch.ID, filename).Limit(1).Find(&metas).Error
			if err != nil {
				return err
			}
			labels := labelsByPage[filename]

			if len(metas) == 0 {
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
				pm := comicdb.PageMeta{
					ChapterID: ch.ID,
					FileName:  filename,
					Format:    format,
					Size:      size,
					Labels:    labels,
				}
				if err := tx.Create(&pm).Error; err != nil {
					return err
				}
			} else {
				pm := metas[0]
				pm.Labels = labels
				if pm.Size[0] == 0 && pm.Size[1] == 0 {
					filePath := filepath.Join(workDir, ch.DirName, filename)
					if f, err := os.Open(filePath); err == nil {
						if cfg, _, err := image.DecodeConfig(f); err == nil {
							pm.Size = [2]uint{uint(cfg.Width), uint(cfg.Height)}
						}
						f.Close()
					}
				}
				if err := tx.Save(&pm).Error; err != nil {
					return err
				}
			}
		}

		return nil
	})
}

// NewComicAgent creates and returns a new instance of ComicAgent.
func NewComicAgent() ComicAgent {
	return new(comicAgentImpl)
}
