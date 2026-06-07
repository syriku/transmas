package comicdb

import (
	"github.com/syriku/label-go/comic"
	"github.com/syriku/label-go/label"
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
	ChapterID uint              `gorm:"uniqueIndex:idx_chapter_filename"`
	FileName  string            `gorm:"uniqueIndex:idx_chapter_filename" json:"filename"`
	Format    comic.ImageFormat `json:"format"`
	Size      [2]uint           `gorm:"serializer:json" json:"size"`
	Labels    label.Labels      `gorm:"serializer:json" json:"labels"`
}

type Chapter struct {
	gorm.Model
	Title     string `gorm:"uniqueIndex:idx_chapter_comic_order"`
	Order     uint   `gorm:"uniqueIndex:idx_chapter_comic_order"`
	DirName   string
	PageCount uint
	Pages     []string `gorm:"serializer:json"`
	Tags      []string `gorm:"serializer:json"`
}
