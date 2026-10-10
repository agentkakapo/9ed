package chat

import (
	"encoding/json"
	"os/exec"
	"strings"
	"testing"

	"github.com/brainplusplus/9ed/internal/chat/acp"
	"github.com/brainplusplus/9ed/internal/chat/acpinstall"
)

func TestCommandFromToolCallRequiresExecutableKind(t *testing.T) {
	raw, err := json.Marshal(map[string]string{"command": "Get-ChildItem"})
	if err != nil {
		t.Fatalf("Marshal returned error: %v", err)
	}

	if got := commandFromToolCall(acp.ToolCallUpdate{
		Kind:     acp.ToolKind("other"),
		RawInput: raw,
	}); got != "" {
		t.Fatalf("expected non-executable tool kind to be ignored, got %q", got)
	}

	if got := commandFromToolCall(acp.ToolCallUpdate{
		Kind:     acp.ToolKindExecute,
		RawInput: raw,
	}); got != "Get-ChildItem" {
		t.Fatalf("expected execute tool command, got %q", got)
	}
}

func TestApplyRememberedToolMetaFillsCompletedUpdate(t *testing.T) {
	session := &acpSession{
		toolMeta: make(map[string]acpToolMeta),
	}
	raw, err := json.Marshal(map[string]string{"selector": `a[href*="/d-"]`})
	if err != nil {
		t.Fatalf("Marshal returned error: %v", err)
	}

	session.rememberToolMeta("tool-1", "9ed-active-browser_9ed_browser_click", acp.ToolKind("browser"), raw)

	update := acp.ToolCallStatusUpdate{
		ToolCallID: "tool-1",
		Status:     acp.ToolStatusCompleted,
	}
	session.applyRememberedToolMeta(&update)

	if update.Title != "9ed-active-browser_9ed_browser_click" {
		t.Fatalf("expected remembered title, got %q", update.Title)
	}
	if string(update.Kind) != "browser" {
		t.Fatalf("expected remembered kind, got %q", update.Kind)
	}
	if string(update.RawInput) != string(raw) {
		t.Fatalf("expected remembered raw input, got %s", string(update.RawInput))
	}
}

func TestDecorateActiveToolMessageAddsWorkflowGuidance(t *testing.T) {
	got := decorateActiveToolMessage("debug why page A errors", true, true)

	if !strings.Contains(got, "debug why page A errors") {
		t.Fatalf("expected original prompt to be preserved, got %q", got)
	}
	if !strings.Contains(got, "whether the need comes from the user's words or from your own analysis") {
		t.Fatalf("expected workflow-based browser guidance, got %q", got)
	}
	if !strings.Contains(got, "Do not use 9ed_browser_screenshot just to decide what to click") {
		t.Fatalf("expected screenshot guardrail, got %q", got)
	}
	if !strings.Contains(got, "Chain terminal commands when the last result reveals the next necessary diagnostic or fix step") {
		t.Fatalf("expected terminal chaining guidance, got %q", got)
	}
}

func TestDiscoverAgentsIncludesAntigravity(t *testing.T) {
	agents := DiscoverAgents()
	var found bool
	for _, a := range agents {
		if a.ID == "antigravity" {
			found = true
			if a.Label != "Google Antigravity" {
				t.Errorf("expected label %q, got %q", "Google Antigravity", a.Label)
			}
			if a.Command == "" {
				t.Error("expected non-empty command for antigravity")
			}
			break
		}
	}
	if !found {
		t.Fatal("expected antigravity to be found in DiscoverAgents")
	}
}

func TestDiscoverAgentDescriptorsIncludesAntigravity(t *testing.T) {
	descriptors := DiscoverAgentDescriptors()
	var found *AgentDescriptor
	for i := range descriptors {
		if descriptors[i].ID == "antigravity" {
			found = &descriptors[i]
			break
		}
	}
	if found == nil {
		t.Fatal("expected antigravity in DiscoverAgentDescriptors")
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

func TestAntigravityAdapterInfo(t *testing.T) {
	info := acpinstall.GetAdapterInfo("antigravity")
	if info == nil {
		t.Fatal("expected acpinstall adapter info for antigravity")
	}
	if info.ID != "antigravity" {
		t.Errorf("expected ID antigravity, got %q", info.ID)
	}
	if info.Manager != "binary" {
		t.Errorf("expected Manager binary, got %q", info.Manager)
	}
}
