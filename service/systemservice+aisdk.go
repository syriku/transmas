package service

import (
	"context"
	"fmt"
	"time"

	"github.com/syriku/aisdk/api"
)

// GetModels retrieves a list of models using the provided UserConfig.
func (s *SystemService) GetModels(config api.UserConfig) ([]string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	factory := api.NewFactory(config)
	if factory == nil {
		return nil, fmt.Errorf("unsupported API type or invalid user config")
	}

	modelsApi := factory.Models()
	if modelsApi == nil {
		return nil, fmt.Errorf("models API is not implemented for this provider")
	}

	models, err := modelsApi.GetModels(ctx)
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return nil, fmt.Errorf("request timed out while fetching models")
		}
		return nil, err
	}

	return models, nil
}
