package filesystem

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSearchFindsMatchingLines(t *testing.T) {
	dir := t.TempDir()
	_ = os.WriteFile(filepath.Join(dir, "main.go"), []byte("package main\n// TODO: fix this\nfunc main() {}\n"), 0644)

	results, err := Search(dir, "TODO", false, 100)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}

	if results[0].Line != 2 {
		t.Fatalf("expected line 2, got %d", results[0].Line)
	}
}

func TestSearchRespectsMaxResults(t *testing.T) {
	dir := t.TempDir()
	content := "match\nmatch\nmatch\nmatch\nmatch\n"
	_ = os.WriteFile(filepath.Join(dir, "many.txt"), []byte(content), 0644)

	results, err := Search(dir, "match", false, 2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}
}

func TestSearchRecursesSubdirectories(t *testing.T) {
	dir := t.TempDir()
	sub := filepath.Join(dir, "sub")
	_ = os.Mkdir(sub, 0755)
	_ = os.WriteFile(filepath.Join(sub, "nested.txt"), []byte("findme here\n"), 0644)

	results, err := Search(dir, "findme", false, 100)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
}

func TestSearchWithRegex(t *testing.T) {
	dir := t.TempDir()
	_ = os.WriteFile(filepath.Join(dir, "code.go"), []byte("func Hello() {}\nfunc World() {}\n"), 0644)

	results, err := Search(dir, `func \w+\(\)`, true, 100)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}
}

func TestSearchEmptyReturnsNonNilSlice(t *testing.T) {
	dir := t.TempDir()
	results, err := Search(dir, "nonexistent", false, 100)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if results == nil {
		t.Fatalf("expected non-nil empty slice, got nil")
	}
	if len(results) != 0 {
		t.Fatalf("expected 0 results, got %d", len(results))
	}
}

func TestSearchSkipsIgnoredDirectories(t *testing.T) {
	dir := t.TempDir()
	gitDir := filepath.Join(dir, ".git")
	_ = os.Mkdir(gitDir, 0755)
	_ = os.WriteFile(filepath.Join(gitDir, "index"), []byte("SECRET"), 0644)
	nodeDir := filepath.Join(dir, "node_modules")
	_ = os.Mkdir(nodeDir, 0755)
	_ = os.WriteFile(filepath.Join(nodeDir, "dep.js"), []byte("SECRET"), 0644)
	_ = os.WriteFile(filepath.Join(dir, "src.js"), []byte("SECRET"), 0644)

	results, err := Search(dir, "SECRET", false, 100)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result from src.js, got %d: %+v", len(results), results)
	}
	if results[0].Path != "src.js" {
		t.Fatalf("expected src.js, got %s", results[0].Path)
	}
}

func TestSearchCaseInsensitive(t *testing.T) {
	dir := t.TempDir()
	_ = os.WriteFile(filepath.Join(dir, "app.go"), []byte("func SuperFunction() {}\n"), 0644)

	results, err := Search(dir, "superfunction", false, 100)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
}

func TestSearchCaseSensitiveOption(t *testing.T) {
	dir := t.TempDir()
	_ = os.WriteFile(filepath.Join(dir, "app.go"), []byte("func SuperFunction() {}\n"), 0644)

	// Case sensitive should not match lowercase
	results, err := SearchWithOptions(dir, SearchOptions{
		Query:         "superfunction",
		UseRegex:      false,
		CaseSensitive: true,
		MaxResults:    100,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 0 {
		t.Fatalf("expected 0 results, got %d", len(results))
	}

	// Case sensitive should match exact case
	resultsExact, err := SearchWithOptions(dir, SearchOptions{
		Query:         "SuperFunction",
		UseRegex:      false,
		CaseSensitive: true,
		MaxResults:    100,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resultsExact) != 1 {
		t.Fatalf("expected 1 result, got %d", len(resultsExact))
	}
}

func TestSearchSkipsBinaryFiles(t *testing.T) {
	dir := t.TempDir()
	_ = os.WriteFile(filepath.Join(dir, "binary.bin"), []byte{0x00, 'T', 'E', 'S', 'T', 0x00}, 0644)
	_ = os.WriteFile(filepath.Join(dir, "text.txt"), []byte("TEST"), 0644)

	results, err := Search(dir, "TEST", false, 100)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result from text.txt, got %d", len(results))
	}
	if results[0].Path != "text.txt" {
		t.Fatalf("expected text.txt, got %s", results[0].Path)
	}
}

func TestSearchMatchesFilename(t *testing.T) {
	dir := t.TempDir()
	_ = os.WriteFile(filepath.Join(dir, "SpecialHelper.ts"), []byte("// empty"), 0644)

	results, err := Search(dir, "SpecialHelper", false, 100)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	if results[0].Path != "SpecialHelper.ts" {
		t.Fatalf("expected SpecialHelper.ts, got %s", results[0].Path)
	}
}
