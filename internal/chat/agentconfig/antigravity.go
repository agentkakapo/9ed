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

	return cfg
}
