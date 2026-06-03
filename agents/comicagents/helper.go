package comicagents

import "github.com/syriku/label-go/comic"

func NewComic(config func(*comic.WorkComic)) comic.WorkComic {
	self := new(comic.WorkComic)
	if config != nil {
		config(self)
	}
	return *self
}
