package comicagents

import (
	"os"
	"path/filepath"
	"strings"
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
						Tag:        1,
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

	// Verify labels in page metas
	var dbPageMetas []comicdb.PageMeta
	if err := db.Find(&dbPageMetas).Error; err != nil {
		t.Fatalf("failed to query page metas from db: %v", err)
	}
	if len(dbPageMetas) != 2 {
		t.Fatalf("expected 2 page metas in db, got %d", len(dbPageMetas))
	}
	var page1Meta comicdb.PageMeta
	for _, pm := range dbPageMetas {
		if pm.FileName == "page1.jpg" {
			page1Meta = pm
			break
		}
	}
	if len(page1Meta.Labels) != 1 {
		t.Errorf("expected 1 label on page1.jpg, got %d", len(page1Meta.Labels))
	} else {
		l := page1Meta.Labels[0]
		if l.Text != "Hello World" {
			t.Errorf("expected label text 'Hello World', got '%s'", l.Text)
		}
		if l.Page != "page1.jpg" {
			t.Errorf("expected label page 'page1.jpg', got '%s'", l.Page)
		}
	}

	// Verify PageMeta database records
	{
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

func TestLabelsAndLpOperations(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "transmas-comicagent-lp-test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	workComic := comic.WorkComic{
		Comic: comic.Comic{
			Title:    "Test LP Comic",
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
						FileName: "page2.jpg",
						Format:   comic.JPG,
						Size:     [2]uint{800, 600},
					},
				},
				Tags: []string{"inside", "outside"},
			},
		},
	}

	agent := NewComicAgent()
	if err := agent.EnsureProject(workComic); err != nil {
		t.Fatalf("EnsureProject failed: %v", err)
	}

	// 1. Test UpdatePageLabels
	labels1 := label.Labels{
		{
			Pos:        [2]float32{0.1, 0.2},
			Tag:        1,
			Text:       "Label 1",
			Translated: true,
			Reviewed:   false,
			Page:       "page1.jpg",
		},
	}
	if err := agent.UpdatePageLabels(tempDir, 1, "page1.jpg", labels1); err != nil {
		t.Fatalf("UpdatePageLabels failed: %v", err)
	}

	labels2 := label.Labels{
		{
			Pos:        [2]float32{0.5, 0.6},
			Tag:        2,
			Text:       "Label 2",
			Translated: true,
			Reviewed:   true,
			Page:       "page2.jpg",
		},
	}
	if err := agent.UpdatePageLabels(tempDir, 1, "page2.jpg", labels2); err != nil {
		t.Fatalf("UpdatePageLabels failed: %v", err)
	}

	// 2. Test MergeLabels
	merged, err := agent.MergeLabels(tempDir, 1)
	if err != nil {
		t.Fatalf("MergeLabels failed: %v", err)
	}
	if len(merged) != 2 {
		t.Errorf("expected 2 merged labels, got %d", len(merged))
	} else {
		if merged[0].Text != "Label 1" || merged[1].Text != "Label 2" {
			t.Errorf("unexpected merged labels: %+v", merged)
		}
	}

	// 3. Test ExportLp
	lpPath := filepath.Join(tempDir, "exported.txt")
	if err := agent.ExportLp(tempDir, 1, lpPath); err != nil {
		t.Fatalf("ExportLp failed: %v", err)
	}
	contentBytes, err := os.ReadFile(lpPath)
	if err != nil {
		t.Fatalf("failed to read exported LP file: %v", err)
	}
	lpContent := string(contentBytes)
	if !strings.Contains(lpContent, ">>>>>>>>[page1.jpg]<<<<<<<<") ||
		!strings.Contains(lpContent, ">>>>>>>>[page2.jpg]<<<<<<<<") ||
		!strings.Contains(lpContent, "Label 1") ||
		!strings.Contains(lpContent, "Label 2") {
		t.Errorf("exported LP format is incorrect:\n%s", lpContent)
	}

	// 4. Test ImportLp
	customLp := `1,0
-
inside
outside
new_tag
-
Test import

>>>>>>>>[page1.jpg]<<<<<<<<
----------------[1]----------------[0.1000,0.2000,1]
Label 1 Imported

>>>>>>>>[page2.jpg]<<<<<<<<
----------------[1]----------------[0.5000,0.6000,3]
Label 2 Imported

`
	lpImportPath := filepath.Join(tempDir, "imported.txt")
	if err := os.WriteFile(lpImportPath, []byte(customLp), 0644); err != nil {
		t.Fatalf("failed to write custom LP: %v", err)
	}

	if err := agent.ImportLp(tempDir, 1, lpImportPath); err != nil {
		t.Fatalf("ImportLp failed: %v", err)
	}

	// Verify imported tags
	tags, err := agent.GetChapterTags(tempDir, 1)
	if err != nil {
		t.Fatalf("GetChapterTags failed: %v", err)
	}
	if len(tags) != 3 || tags[2] != "new_tag" {
		t.Errorf("expected 3 tags with 'new_tag' at the end, got %v", tags)
	}

	// Verify imported labels on pages
	metas, err := agent.GetChapterPageMetas(tempDir, 1)
	if err != nil {
		t.Fatalf("GetChapterPageMetas failed: %v", err)
	}

	for _, pm := range metas {
		if pm.FileName == "page1.jpg" {
			if len(pm.Labels) != 1 || pm.Labels[0].Text != "Label 1 Imported" || pm.Labels[0].Tag != 1 {
				t.Errorf("page1 labels not imported correctly: %+v", pm.Labels)
			}
		} else if pm.FileName == "page2.jpg" {
			if len(pm.Labels) != 1 || pm.Labels[0].Text != "Label 2 Imported" || pm.Labels[0].Tag != 3 {
				t.Errorf("page2 labels not imported correctly: %+v", pm.Labels)
			}
		}
	}
}
