package comicagents

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/syriku/label-go/comic"
	"github.com/syriku/label-go/label"
	"github.com/syriku/transmas/agents/comicagents/comicdb"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestEnsureProject(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "transmas-comicagent-test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	workComic := comic.WorkComic{
		Comic: comic.Comic{
			Title:    "Test Comic",
			Chapters: 1,
		},
		WorkDir: tempDir,
		Chapters: []comic.WorkChapter{
			{
				Chapter: comic.Chapter{
					Title:     "Chapter 1",
					Order:     1,
					PageCount: 2,
				},
				DirName: "chap1",
				Pages: []comic.PageMeta{
					{
						FileName: "page1.jpg",
						Format:   comic.JPG,
						Size:     [2]uint{800, 600},
					},
					{
						FileName: "page2.png",
						Format:   comic.PNG,
						Size:     [2]uint{1024, 768},
					},
				},
				Labels: label.Labels{
					{
						Pos:        [2]float32{10.0, 20.0},
						Tag:        "dialogue",
						Text:       "Hello World",
						Translated: false,
						Reviewed:   false,
						Page:       "page1.jpg",
					},
				},
				Tags: []string{"dialogue", "thought"},
			},
		},
	}

	agent := NewComicAgent()

	// Call EnsureProject for the first time
	err = agent.EnsureProject(workComic)
	if err != nil {
		t.Fatalf("EnsureProject failed: %v", err)
	}

	// Verify database file exists
	dbFile := filepath.Join(tempDir, "comic_project")
	if _, err := os.Stat(dbFile); os.IsNotExist(err) {
		t.Fatalf("database file does not exist at %s", dbFile)
	}

	// Connect to the database to inspect records
	db, err := gorm.Open(sqlite.Open(dbFile), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect to created db: %v", err)
	}

	var dbComic comicdb.Comic
	if err := db.First(&dbComic).Error; err != nil {
		t.Fatalf("failed to query comic from db: %v", err)
	}
	if dbComic.Title != "Test Comic" {
		t.Errorf("expected comic title 'Test Comic', got '%s'", dbComic.Title)
	}

	var dbChapters []comicdb.Chapter
	if err := db.Find(&dbChapters).Error; err != nil {
		t.Fatalf("failed to query chapters from db: %v", err)
	}
	if len(dbChapters) != 1 {
		t.Errorf("expected 1 chapter, got %d", len(dbChapters))
	} else {
		ch := dbChapters[0]
		if ch.Title != "Chapter 1" {
			t.Errorf("expected chapter title 'Chapter 1', got '%s'", ch.Title)
		}
		if len(ch.Pages) != 2 {
			t.Errorf("expected 2 page metas, got %d", len(ch.Pages))
		}
		if len(ch.Tags) != 2 {
			t.Errorf("expected 2 tags, got %d", len(ch.Tags))
		}
	}

	var dbLabels []comicdb.Label
	if err := db.Find(&dbLabels).Error; err != nil {
		t.Fatalf("failed to query labels from db: %v", err)
	}
	if len(dbLabels) != 1 {
		t.Errorf("expected 1 label, got %d", len(dbLabels))
	} else {
		l := dbLabels[0]
		if l.Text != "Hello World" {
			t.Errorf("expected label text 'Hello World', got '%s'", l.Text)
		}
	}

	// Verify PageMeta database records
	var dbPageMetas []comicdb.PageMeta
	if err := db.Find(&dbPageMetas).Error; err != nil {
		t.Fatalf("failed to query page metas from db: %v", err)
	}
	if len(dbPageMetas) != 2 {
		t.Errorf("expected 2 page metas in db, got %d", len(dbPageMetas))
	} else {
		pm := dbPageMetas[0]
		if pm.FileName != "page1.jpg" {
			t.Errorf("expected page1.jpg, got %s", pm.FileName)
		}
	}

	// Call EnsureProject a second time and make sure it does not duplicate
	err = agent.EnsureProject(workComic)
	if err != nil {
		t.Fatalf("second EnsureProject call failed: %v", err)
	}

	var totalComics int64
	db.Model(&comicdb.Comic{}).Count(&totalComics)
	if totalComics != 1 {
		t.Errorf("expected 1 comic after second run, got %d", totalComics)
	}
}

func TestUpdateAndGetChapterPages(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "transmas-comicagent-pages-test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	workComic := comic.WorkComic{
		Comic: comic.Comic{
			Title:    "Test Comic Pages",
			Chapters: 1,
		},
		WorkDir: tempDir,
		Chapters: []comic.WorkChapter{
			{
				Chapter: comic.Chapter{
					Title:     "Chapter 1",
					Order:     1,
					PageCount: 0,
				},
				DirName: "chap1",
				Pages:   []comic.PageMeta{},
			},
		},
	}

	agent := NewComicAgent()
	err = agent.EnsureProject(workComic)
	if err != nil {
		t.Fatalf("EnsureProject failed: %v", err)
	}

	// Create chapter directory
	chapDir := filepath.Join(tempDir, "chap1")
	if err := os.MkdirAll(chapDir, 0755); err != nil {
		t.Fatalf("failed to create chap dir: %v", err)
	}

	// Create dummy files
	if err := os.WriteFile(filepath.Join(chapDir, "img1.png"), []byte("png"), 0644); err != nil {
		t.Fatalf("failed to write dummy: %v", err)
	}
	if err := os.WriteFile(filepath.Join(chapDir, "img2.jpg"), []byte("jpg"), 0644); err != nil {
		t.Fatalf("failed to write dummy: %v", err)
	}

	// Update chapter pages
	pages := []string{"img2.jpg", "img1.png"}
	err = agent.UpdateChapterPages(tempDir, 1, pages)
	if err != nil {
		t.Fatalf("UpdateChapterPages failed: %v", err)
	}

	// Retrieve page metas
	metas, err := agent.GetChapterPageMetas(tempDir, 1)
	if err != nil {
		t.Fatalf("GetChapterPageMetas failed: %v", err)
	}

	if len(metas) != 2 {
		t.Fatalf("expected 2 metas, got %d", len(metas))
	}
	if metas[0].FileName != "img2.jpg" || metas[1].FileName != "img1.png" {
		t.Errorf("unexpected ordered metas: %v", metas)
	}
	if metas[1].Format != comic.PNG {
		t.Errorf("expected PNG format for img1.png, got %v", metas[1].Format)
	}

	// Test user's comment behavior: even if page is removed, it remains in PageMeta table.
	pages2 := []string{"img1.png"}
	err = agent.UpdateChapterPages(tempDir, 1, pages2)
	if err != nil {
		t.Fatalf("second UpdateChapterPages failed: %v", err)
	}

	// Connect to db and verify PageMeta count is still 2
	dbFile := filepath.Join(tempDir, "comic_project")
	db, err := gorm.Open(sqlite.Open(dbFile), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect to db: %v", err)
	}

	var count int64
	if err := db.Model(&comicdb.PageMeta{}).Count(&count).Error; err != nil {
		t.Fatalf("failed to count pagemetas: %v", err)
	}
	if count != 2 {
		t.Errorf("expected 2 page metas in DB, got %d", count)
	}

	// GetChapterPageMetas should now return only 1 meta corresponding to the active pages
	activeMetas, err := agent.GetChapterPageMetas(tempDir, 1)
	if err != nil {
		t.Fatalf("GetChapterPageMetas failed: %v", err)
	}
	if len(activeMetas) != 1 {
		t.Errorf("expected 1 active meta, got %d", len(activeMetas))
	} else if activeMetas[0].FileName != "img1.png" {
		t.Errorf("expected active meta img1.png, got %s", activeMetas[0].FileName)
	}
}

func TestChapterTags(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "transmas-comicagent-tags-test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// 1. 测试 EnsureProject 创建项目时 tags 的默认值逻辑
	workComic := comic.WorkComic{
		Comic: comic.Comic{
			Title:    "Test Comic Tags",
			Chapters: 1,
		},
		WorkDir: tempDir,
		Chapters: []comic.WorkChapter{
			{
				Chapter: comic.Chapter{
					Title:     "Chapter 1",
					Order:     1,
					PageCount: 0,
				},
				DirName: "chap1",
				Pages:   []comic.PageMeta{},
				Tags:    []string{}, // 空 tags
			},
		},
	}

	agent := NewComicAgent()
	err = agent.EnsureProject(workComic)
	if err != nil {
		t.Fatalf("EnsureProject failed: %v", err)
	}

	// 查询 tags，应该返回默认值 (inside, outside)
	tags, err := agent.GetChapterTags(tempDir, 1)
	if err != nil {
		t.Fatalf("GetChapterTags failed: %v", err)
	}
	expectedDefaults := []string{TagInside, TagOutside}
	if len(tags) != 2 || tags[0] != TagInside || tags[1] != TagOutside {
		t.Errorf("expected default tags %v, got %v", expectedDefaults, tags)
	}

	// 2. 测试 AddChapter 时 tags 的默认值逻辑
	err = agent.AddChapter(tempDir, 2, "Chapter 2")
	if err != nil {
		t.Fatalf("AddChapter failed: %v", err)
	}
	tags2, err := agent.GetChapterTags(tempDir, 2)
	if err != nil {
		t.Fatalf("GetChapterTags failed: %v", err)
	}
	if len(tags2) != 2 || tags2[0] != TagInside || tags2[1] != TagOutside {
		t.Errorf("expected default tags %v for chapter 2, got %v", expectedDefaults, tags2)
	}

	// 3. 测试既有项目（Tags 字段为空）在查询时被更新为默认值
	dbFile := filepath.Join(tempDir, "comic_project")
	db, err := gorm.Open(sqlite.Open(dbFile), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect to db: %v", err)
	}
	// 将 Chapter 2 的 tags 清空
	err = db.Model(&comicdb.Chapter{}).Where("`order` = ?", 2).Update("tags", []string{}).Error
	if err != nil {
		t.Fatalf("failed to clear tags in db: %v", err)
	}

	// 再次查询 Chapter 2，应该回填默认值并返回
	tags2Cleared, err := agent.GetChapterTags(tempDir, 2)
	if err != nil {
		t.Fatalf("GetChapterTags failed: %v", err)
	}
	if len(tags2Cleared) != 2 || tags2Cleared[0] != TagInside || tags2Cleared[1] != TagOutside {
		t.Errorf("expected tags default backfilled, got %v", tags2Cleared)
	}

	// 验证数据库里是否真的被回填更新了
	var ch2 comicdb.Chapter
	if err := db.Where("`order` = ?", 2).First(&ch2).Error; err != nil {
		t.Fatalf("failed to query chapter 2: %v", err)
	}
	if len(ch2.Tags) != 2 || ch2.Tags[0] != TagInside || ch2.Tags[1] != TagOutside {
		t.Errorf("expected DB tags backfilled, got %v", ch2.Tags)
	}

	// 4. 测试 SetChapterTags
	// 4.1 正常设置与去重、去空白
	newTags := []string{"  inside ", "custom_tag", "inside", "  "}
	err = agent.SetChapterTags(tempDir, 1, newTags)
	if err != nil {
		t.Fatalf("SetChapterTags failed: %v", err)
	}
	tags1Updated, err := agent.GetChapterTags(tempDir, 1)
	if err != nil {
		t.Fatalf("GetChapterTags failed: %v", err)
	}
	expectedUpdated := []string{"inside", "custom_tag"}
	if len(tags1Updated) != 2 || tags1Updated[0] != "inside" || tags1Updated[1] != "custom_tag" {
		t.Errorf("expected tags %v, got %v", expectedUpdated, tags1Updated)
	}

	// 4.2 传入空切片/全是空值的切片，应该报错
	err = agent.SetChapterTags(tempDir, 1, []string{})
	if err == nil {
		t.Error("expected error when setting empty tags, got nil")
	}
	err = agent.SetChapterTags(tempDir, 1, []string{"   ", ""})
	if err == nil {
		t.Error("expected error when setting blank tags, got nil")
	}
}
