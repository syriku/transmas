package comicdb

import (
	"github.com/syriku/label-go/comic"
	"gorm.io/gorm"
)

type Comic struct {
	gorm.Model
	Title    string `gorm:"uniqueIndex"`
	Chapters uint
	WorkDir  string
}

type PageMeta struct {
	gorm.Model
	ComicID   uint              `gorm:"uniqueIndex:idx_comic_chapter_filename"`
	ChapterID uint              `gorm:"uniqueIndex:idx_comic_chapter_filename"`
	FileName  string            `gorm:"uniqueIndex:idx_comic_chapter_filename" json:"filename"`
	Format    comic.ImageFormat `json:"format"`
	Size      [2]uint           `gorm:"serializer:json" json:"size"`
}

type Chapter struct {
	gorm.Model
	ComicID   uint   `gorm:"index"`
	Title     string `gorm:"uniqueIndex:idx_chapter_comic_order"`
	Order     uint   `gorm:"uniqueIndex:idx_chapter_comic_order"`
	DirName   string
	PageCount uint
	Pages     []string `gorm:"serializer:json"`
	Tags      []string `gorm:"serializer:json"`
}

type Label struct {
	gorm.Model
	ChapterID  uint `gorm:"index"`
	PosX       float32
	PosY       float32
	Tag        string
	Text       string
	Translated bool
	Reviewed   bool
	Page       string
}
