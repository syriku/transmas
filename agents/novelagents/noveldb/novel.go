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
	dbEntries := make([]GlossaryEntry, len(entries))
	for i, e := range entries {
		dbEntries[i] = GlossaryEntry{
			Source: e.Source,
			Target: e.Target,
			Note:   e.Note,
		}
	}
	return dbEntries
}

func FromDB(dbEntries []GlossaryEntry) []request.GlossaryEntry {
	entries := make([]request.GlossaryEntry, len(dbEntries))
	for i, e := range dbEntries {
		entries[i] = request.GlossaryEntry{
			Source: e.Source,
			Target: e.Target,
			Note:   e.Note,
		}
	}
	return entries
}
