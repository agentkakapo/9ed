import { useCallback, useRef, useState } from 'react';
import { searchFiles } from '../../api';
import type { SearchResult } from '../../types';

type SearchPanelProps = {
  rootPath: string;
  onResultClick: (filePath: string, fileName: string, line?: number, col?: number) => void;
};

export function SearchPanel({ rootPath, onResultClick }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const executeSearch = useCallback(
    async (q: string, regex: boolean, cs: boolean) => {
      const trimmed = q.trim();
      if (!trimmed) {
        setResults([]);
        setError(null);
        setHasSearched(false);
        return;
      }
      setSearching(true);
      setError(null);
      try {
        const found = await searchFiles(rootPath, trimmed, regex, 100, cs);
        setResults(Array.isArray(found) ? found : []);
        setHasSearched(true);
      } catch (err) {
        console.error('Search failed:', err);
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
        setHasSearched(true);
      } finally {
        setSearching(false);
      }
    },
    [rootPath],
  );

  const handleSearch = useCallback(() => {
    void executeSearch(query, useRegex, caseSensitive);
  }, [executeSearch, query, useRegex, caseSensitive]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSearch();
      }
    },
    [handleSearch],
  );

  const toggleCase = () => {
    const next = !caseSensitive;
    setCaseSensitive(next);
    if (query.trim()) {
      void executeSearch(query, useRegex, next);
    }
  };

  const toggleRegex = () => {
    const next = !useRegex;
    setUseRegex(next);
    if (query.trim()) {
      void executeSearch(query, next, caseSensitive);
    }
  };

  const clearQuery = () => {
    setQuery('');
    setResults([]);
    setError(null);
    setHasSearched(false);
    inputRef.current?.focus();
  };

  const sep = rootPath.includes('\\') ? '\\' : '/';

  return (
    <div className="search-panel">
      <div className="search-input-row">
        <div className="search-input-wrap">
          <input
            ref={inputRef}
            className="search-input"
            type="text"
            placeholder="Search in files…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Search files"
            spellCheck={false}
          />
          {query && (
            <button
              className="search-clear-btn"
              onClick={clearQuery}
              type="button"
              title="Clear search"
              aria-label="Clear"
            >
              ✕
            </button>
          )}
          <div className="search-options">
            <button
              type="button"
              className={`search-option-btn${caseSensitive ? ' active' : ''}`}
              onClick={toggleCase}
              title="Match Case"
              aria-label="Match case"
              aria-pressed={caseSensitive}
            >
              Aa
            </button>
            <button
              type="button"
              className={`search-option-btn${useRegex ? ' active' : ''}`}
              onClick={toggleRegex}
              title="Use Regular Expression"
              aria-label="Use regex"
              aria-pressed={useRegex}
            >
              .*
            </button>
          </div>
        </div>
        <button
          className="search-btn"
          onClick={handleSearch}
          disabled={searching || !query.trim()}
          type="button"
          title="Search (Enter)"
        >
          {searching ? '…' : '🔍'}
        </button>
      </div>

      {error && <div className="search-error-banner">{error}</div>}

      {hasSearched && !searching && !error && (
        <div className="search-status-bar">
          {results.length > 0 ? (
            <span>
              {results.length} result{results.length === 1 ? '' : 's'} found
            </span>
          ) : (
            <span>No results found</span>
          )}
        </div>
      )}

      <div className="search-results">
        {results.map((r, i) => {
          const fileName = r.path.split(/[/\\]/).pop() ?? r.path;
          const fullPath =
            r.path.startsWith('/') || /^[a-zA-Z]:/.test(r.path)
              ? r.path
              : rootPath.endsWith(sep)
              ? `${rootPath}${r.path}`
              : `${rootPath}${sep}${r.path}`;

          return (
            <button
              key={`${r.path}:${r.line}:${r.column}:${i}`}
              className="search-result-row"
              onClick={() => onResultClick(fullPath, fileName, r.line, r.column)}
              type="button"
              title={`${fullPath}:${r.line}`}
            >
              <span className="search-result-path">
                {r.path}
                {r.line > 0 ? `:${r.line}` : ''}
              </span>
              <span className="search-result-preview">{r.preview}</span>
            </button>
          );
        })}
        {!searching && hasSearched && results.length === 0 && !error && (
          <p className="search-empty">No results found for &ldquo;{query}&rdquo;.</p>
        )}
      </div>
    </div>
  );
}
