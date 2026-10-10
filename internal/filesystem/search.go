package filesystem

import (
	"bufio"
	"bytes"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

type SearchResult struct {
	Path    string `json:"path"`
	Line    int    `json:"line"`
	Column  int    `json:"column"`
	Preview string `json:"preview"`
}

type SearchOptions struct {
	Query         string
	UseRegex      bool
	CaseSensitive bool
	MaxResults    int
}

var ignoredDirs = map[string]bool{
	".git":         true,
	"node_modules": true,
	".cache":       true,
	"dist":         true,
	"build":        true,
	".next":        true,
	".nuxt":        true,
	".turbo":       true,
	".output":      true,
	".svn":         true,
	".hg":          true,
	"vendor":       true,
	".idea":        true,
	".vscode":      true,
	"coverage":     true,
	"__pycache__":  true,
}

var binaryExts = map[string]bool{
	".png": true, ".jpg": true, ".jpeg": true, ".gif": true, ".webp": true, ".ico": true,
	".pdf": true, ".zip": true, ".tar": true, ".gz": true, ".bz2": true, ".7z": true, ".rar": true,
	".exe": true, ".dll": true, ".so": true, ".dylib": true, ".bin": true, ".wasm": true,
	".pyc": true, ".class": true, ".o": true, ".a": true,
	".mp3": true, ".mp4": true, ".wav": true, ".avi": true, ".mov": true, ".webm": true,
	".woff": true, ".woff2": true, ".ttf": true, ".eot": true,
	".db": true, ".sqlite": true, ".sqlite3": true,
	".map": true,
}

func isBinaryFile(path string) bool {
	f, err := os.Open(path)
	if err != nil {
		return false
	}
	defer f.Close()

	buf := make([]byte, 512)
	n, err := f.Read(buf)
	if err != nil && n == 0 {
		return false
	}
	return bytes.IndexByte(buf[:n], 0) != -1
}

func Search(root string, query string, useRegex bool, maxResults int) ([]SearchResult, error) {
	return SearchWithOptions(root, SearchOptions{
		Query:         query,
		UseRegex:      useRegex,
		CaseSensitive: false,
		MaxResults:    maxResults,
	})
}

func SearchWithOptions(root string, opts SearchOptions) ([]SearchResult, error) {
	maxResults := opts.MaxResults
	if maxResults <= 0 {
		maxResults = 100
	}

	results := make([]SearchResult, 0)
	queryTrimmed := strings.TrimSpace(opts.Query)
	if queryTrimmed == "" {
		return results, nil
	}

	var pattern *regexp.Regexp
	if opts.UseRegex {
		patternStr := opts.Query
		if !opts.CaseSensitive && !strings.HasPrefix(patternStr, "(?i)") {
			patternStr = "(?i)" + patternStr
		}
		var err error
		pattern, err = regexp.Compile(patternStr)
		if err != nil {
			return nil, err
		}
	}

	queryLower := strings.ToLower(opts.Query)

	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			if info != nil && info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		if info.IsDir() {
			if path != root && ignoredDirs[info.Name()] {
				return filepath.SkipDir
			}
			return nil
		}

		if len(results) >= maxResults {
			return filepath.SkipAll
		}

		if info.Size() > 1024*1024 {
			return nil
		}

		ext := strings.ToLower(filepath.Ext(path))
		if binaryExts[ext] {
			return nil
		}

		relPath, _ := filepath.Rel(root, path)
		relPathSlash := filepath.ToSlash(relPath)
		fileName := filepath.Base(path)

		var fileNameMatched bool
		if pattern != nil {
			fileNameMatched = pattern.MatchString(fileName) || pattern.MatchString(relPathSlash)
		} else if opts.CaseSensitive {
			fileNameMatched = strings.Contains(fileName, opts.Query) || strings.Contains(relPathSlash, opts.Query)
		} else {
			fileNameMatched = strings.Contains(strings.ToLower(fileName), queryLower) || strings.Contains(strings.ToLower(relPathSlash), queryLower)
		}

		if fileNameMatched {
			results = append(results, SearchResult{
				Path:    relPathSlash,
				Line:    1,
				Column:  1,
				Preview: "[File] " + fileName,
			})
			if len(results) >= maxResults {
				return filepath.SkipAll
			}
		}

		if isBinaryFile(path) {
			return nil
		}

		file, err := os.Open(path)
		if err != nil {
			return nil
		}
		defer file.Close()

		scanner := bufio.NewScanner(file)
		scanBuf := make([]byte, 64*1024)
		scanner.Buffer(scanBuf, 1024*1024)

		lineNum := 0
		for scanner.Scan() {
			lineNum++
			line := scanner.Text()

			var col int
			var matched bool

			if pattern != nil {
				loc := pattern.FindStringIndex(line)
				if loc != nil {
					matched = true
					col = loc[0] + 1
				}
			} else if opts.CaseSensitive {
				idx := strings.Index(line, opts.Query)
				if idx >= 0 {
					matched = true
					col = idx + 1
				}
			} else {
				idx := strings.Index(strings.ToLower(line), queryLower)
				if idx >= 0 {
					matched = true
					col = idx + 1
				}
			}

			if matched {
				preview := strings.TrimSpace(line)
				if len(preview) > 200 {
					preview = preview[:200]
				}

				results = append(results, SearchResult{
					Path:    relPathSlash,
					Line:    lineNum,
					Column:  col,
					Preview: preview,
				})

				if len(results) >= maxResults {
					return filepath.SkipAll
				}
			}
		}

		return nil
	})

	return results, err
}
