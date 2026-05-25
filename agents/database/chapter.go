package database

import "gorm.io/gorm"

type Chapter struct {
	gorm.Model
	Order   uint `gorm:"uniqueIndex:idx_chapter_project"`
	Title   string
	Project uint `gorm:"uniqueIndex:idx_chapter_project"`
}
