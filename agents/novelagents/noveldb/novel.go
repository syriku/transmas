package noveldb

import (
	"github.com/syriku/aisdk/request"
	"gorm.io/gorm"
)

type Novel struct {
	gorm.Model
	Title   string `gorm:"uniqueIndex"`
	WorkDir string
}

type Chapter struct {
	gorm.Model
	Order            uint `gorm:"uniqueIndex"`
	Title            string
	LastChunkSize    int
	LastChunkCount   int
	TranslatedChunks []int `gorm:"serializer:json"`
	ReviewedChunks   []int `gorm:"serializer:json"`
}

type GlossaryEntry struct {
	gorm.Model
	Source string `gorm:"uniqueIndex"`
	Target string
	Note   string
}

func ToDB(entries []request.GlossaryEntry) []GlossaryEntry {
	var dbEntries []GlossaryEntry
	for _, e := range entries {
		dbEntries = append(dbEntries, GlossaryEntry{
			Source: e.Source,
			Target: e.Target,
			Note:   e.Note,
		})
	}
	return dbEntries
}

func FromDB(dbEntries []GlossaryEntry) []request.GlossaryEntry {
	var entries []request.GlossaryEntry
	for _, e := range dbEntries {
		entries = append(entries, request.GlossaryEntry{
			Source: e.Source,
			Target: e.Target,
			Note:   e.Note,
		})
	}
	return entries
}
