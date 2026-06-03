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
