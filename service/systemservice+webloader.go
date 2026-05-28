package service

import (
	"context"
	"time"

	"github.com/syriku/kakuyomu-loader"
)

func (s *SystemService) LoadWebNovel(url string) (*loader.Novel, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	l := loader.NewKakuyomuLoader()
	return l.Load(ctx, url)
}
