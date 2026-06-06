package agents

import (
	"github.com/syriku/aisdk/request"
	"github.com/syriku/transmas/agents/comicagents/comicdb"
	"github.com/syriku/transmas/agents/database"
	"gorm.io/gorm"
)

type ProjectAgent interface {
	ListProjects() ([]database.ProjectInfo, error)
	AddProject(title string, projectType database.ProjectType) error
	RenameProject(oldTitle string, newTitle string) error
	UpdateProjectDir(title string, dir string) error
	GetGlossary(title string) ([]request.GlossaryEntry, error)
	UpdateGlossary(title string, glossary []request.GlossaryEntry) error
	DeleteProject(title string) error
}

type ChapterAgent interface {
	ListChapters(projectName string) ([]database.Chapter, error)
	AddChapter(projectName string, order uint, title string) error
	UpdateChapterTitle(projectName string, order uint, title string) error
	DeleteChapter(projectName string, order uint) error
	UpdateChapterPages(projectName string, chapterOrder uint, pages []string) error
	GetChapterPageMetas(projectName string, chapterOrder uint) ([]comicdb.PageMeta, error)
}

func listProjects(db *gorm.DB, user string) ([]database.ProjectInfo, error) {
	return database.FetchProjectsByOwner(db, user)
}

func addProject(db *gorm.DB, user string, title string, projectType database.ProjectType) error {
	return database.AddProject(db, &database.ProjectInfo{
		Title:       title,
		Owner:       user,
		ProjectType: projectType,
	})
}

func renameProject(db *gorm.DB, user string, oldTitle string, newTitle string) error {
	return database.RenameProject(db, user, oldTitle, newTitle)
}

func updateProjectDir(db *gorm.DB, user string, title string, dir string) error {
	return database.UpdateProjectDir(db, user, title, dir)
}

func getGlossary(db *gorm.DB, user string, title string) ([]request.GlossaryEntry, error) {
	return database.FetchProjectGlossary(db, user, title)
}

func updateGlossary(db *gorm.DB, user string, title string, glossary []request.GlossaryEntry) error {
	return database.UpdateProjectGlossary(db, user, title, glossary)
}

func listChapters(db *gorm.DB, user string, projectName string) ([]database.Chapter, error) {
	proj, err := database.FetchProjectByOwnerAndTitle(db, user, projectName)
	if err != nil {
		return nil, err
	}
	return database.FetchChaptersByProject(db, proj.ID)
}

func addChapter(db *gorm.DB, user string, projectName string, order uint, title string) error {
	proj, err := database.FetchProjectByOwnerAndTitle(db, user, projectName)
	if err != nil {
		return err
	}
	return database.AddChapter(db, &database.Chapter{
		Project: proj.ID,
		Order:   order,
		Title:   title,
	})
}

func updateChapterTitle(db *gorm.DB, user string, projectName string, order uint, title string) error {
	proj, err := database.FetchProjectByOwnerAndTitle(db, user, projectName)
	if err != nil {
		return err
	}
	return database.UpdateChapterTitle(db, proj.ID, order, title)
}

func deleteProject(db *gorm.DB, user string, title string) error {
	return database.DeleteProject(db, user, title)
}

func deleteChapter(db *gorm.DB, user string, projectName string, order uint) error {
	proj, err := database.FetchProjectByOwnerAndTitle(db, user, projectName)
	if err != nil {
		return err
	}
	return database.DeleteChapter(db, proj.ID, order)
}
