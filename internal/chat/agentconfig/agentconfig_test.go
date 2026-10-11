package agentconfig

import (
	"os/exec"
	"testing"
)

func TestDetectAllIncludesAntigravity(t *testing.T) {
	configs := DetectAll()
	var found *AgentConfig
	for i := range configs {
		if configs[i].ID == "antigravity" {
			found = &configs[i]
			break
		}
	}
	if found == nil {
		t.Fatal("expected antigravity in DetectAll")
	}
	if found.Label != "Google Antigravity" {
		t.Errorf("expected label Google Antigravity, got %q", found.Label)
	}
	if _, err := exec.LookPath("agy"); err == nil {
		if !found.Available {
			t.Errorf("expected Available=true when agy is on PATH")
		}
	}
}
