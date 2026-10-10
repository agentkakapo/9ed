package agentconfig

import (
	"os"
	"os/exec"
	"path/filepath"
)

func detectAntigravity() AgentConfig {
	cfg := AgentConfig{
		ID:        "antigravity",
		Label:     "Google Antigravity",
		Models:    []ModelInfo{},
		Providers: []ProviderInfo{},
	}

	if _, err := exec.LookPath("agy"); err != nil {
		return cfg
	}
	cfg.Available = true

	home, err := os.UserHomeDir()
	if err == nil && home != "" {
		cliSettings := filepath.Join(home, ".gemini", "antigravity-cli", "settings.json")
		acpSettings := filepath.Join(home, ".gemini", "antigravity-acp", "settings.json")
		if _, err := os.Stat(cliSettings); err == nil {
			cfg.ConfigFound = true
		} else if _, err := os.Stat(acpSettings); err == nil {
			cfg.ConfigFound = true
		}
	}

	cfg.Providers = append(cfg.Providers, ProviderInfo{
		ID:     "google",
		Name:   "Google",
		HasKey: true,
	})

	knownModels := []struct {
		id, name string
		reason   bool
	}{
		{"gemini-3.8-flash-high", "Gemini 3.8 Flash (High)", true},
		{"gemini-3.8-flash-medium", "Gemini 3.8 Flash (Medium)", true},
		{"gemini-3.8-flash-low", "Gemini 3.8 Flash (Low)", false},
		{"gemini-3.7-flash-high", "Gemini 3.7 Flash (High)", true},
		{"gemini-3.7-flash-medium", "Gemini 3.7 Flash (Medium)", true},
		{"gemini-3.7-flash-low", "Gemini 3.7 Flash (Low)", false},
		{"gemini-3.6-flash-high", "Gemini 3.6 Flash (High)", true},
		{"gemini-3.6-flash-medium", "Gemini 3.6 Flash (Medium)", true},
		{"gemini-3.6-flash-low", "Gemini 3.6 Flash (Low)", false},
		{"gemini-pro-agent", "Gemini 3.1 Pro (High)", true},
		{"gemini-3.1-pro-low", "Gemini 3.1 Pro (Low)", false},
	}
	for _, m := range knownModels {
		cfg.Models = append(cfg.Models, ModelInfo{
			ID:        m.id,
			Name:      m.name,
			Provider:  "google",
			CanReason: m.reason,
		})
	}
	if cfg.ActiveModel == "" {
		cfg.ActiveModel = "gemini-3.8-flash-high"
	}

	return cfg
}
