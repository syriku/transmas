package service

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"time"

	"github.com/syriku/kakuyomu-loader"
)

func (s *SystemService) LoadWebNovel(url string) (*loader.Novel, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	l := loader.NewKakuyomuLoader()
	return l.Load(ctx, url)
}

var invalidFilenameChars = regexp.MustCompile(`[\\/:*?"<>|]`)

func (s *SystemService) SaveNovelTxt(dirPath string, novel *loader.Novel) (string, error) {
	sanitizedTitle := invalidFilenameChars.ReplaceAllString(novel.Title, "_")
	filePath := filepath.Join(dirPath, sanitizedTitle+".txt")
	content := fmt.Sprintf("%s\n\n\n%s", novel.Title, novel.Content)

	err := os.WriteFile(filePath, []byte(content), 0644)
	if err != nil {
		return "", err
	}
	return sanitizedTitle, nil
}
