import { useCallback, useEffect, useRef, useState } from 'react';
import { searchFiles } from '../../api';
import type { FileTab } from '../../types';

type QuickOpenItem = {
  path: string;
  name: string;
  line?: number;
  preview?: string;
  isOpenTab?: boolean;
};

type QuickOpenModalProps = {
  rootPath: string;
  openFiles: FileTab[];
  onSelectFile: (filePath: string, fileName: string, line?: number) => void;
  onClose: () => void;
};

export function QuickOpenModal({ rootPath, openFiles, onSelectFile, onClose }: QuickOpenModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<QuickOpenItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const sep = rootPath.includes('\\') ? '\\' : '/';

  // Populate initially with open files
  useEffect(() => {
    if (!query.trim()) {
      const items: QuickOpenItem[] = openFiles.map((tab) => ({
        path: tab.path,
        name: tab.name,
        isOpenTab: true,
      }));
      setResults(items);
      setSelectedIndex(0);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const found = await searchFiles(rootPath, query.trim(), false, 30);
        if (!active) return;

        const seen = new Set<string>();
        const items: QuickOpenItem[] = [];

        for (const r of found) {
          const fullPath =
            r.path.startsWith('/') || /^[a-zA-Z]:/.test(r.path)
              ? r.path
              : rootPath.endsWith(sep)
              ? `${rootPath}${r.path}`
              : `${rootPath}${sep}${r.path}`;

          const fileName = r.path.split(/[/\\]/).pop() ?? r.path;
          const key = `${fullPath}:${r.line}`;

          if (!seen.has(key)) {
            seen.add(key);
            items.push({
              path: fullPath,
              name: fileName,
              line: r.line,
              preview: r.preview,
            });
          }
        }

        setResults(items);
        setSelectedIndex(0);
      } catch {
        if (!active) return;
        setResults([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 150);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, rootPath, openFiles, sep]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSelect = useCallback(
    (item: QuickOpenItem) => {
      onSelectFile(item.path, item.name, item.line);
      onClose();
    },
    [onSelectFile, onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((idx) => (results.length === 0 ? 0 : (idx + 1) % results.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((idx) => (results.length === 0 ? 0 : (idx - 1 + results.length) % results.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
      }
    },
    [results, selectedIndex, handleSelect, onClose],
  );

  return (
    <div className="quickopen-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Quick open files">
      <div className="quickopen-modal" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="quickopen-input-row">
          <span className="quickopen-icon">🔍</span>
          <input
            ref={inputRef}
            className="quickopen-input"
            type="text"
            placeholder="Type a file name to open…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            spellCheck={false}
            aria-label="Search files by name"
          />
          {loading && <span className="quickopen-spinner">…</span>}
        </div>

        <div className="quickopen-list">
          {results.length === 0 && !loading && (
            <div className="quickopen-empty">
              {query.trim() ? `No files matching "${query}"` : 'No recent files'}
            </div>
          )}

          {results.map((item, idx) => {
            const relDisplay = item.path.startsWith(rootPath)
              ? item.path.slice(rootPath.length).replace(/^[/\\]+/, '')
              : item.path;

            return (
              <div
                key={`${item.path}:${item.line ?? 0}:${idx}`}
                className={`quickopen-item${idx === selectedIndex ? ' active' : ''}`}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                role="button"
                tabIndex={0}
              >
                <div className="quickopen-item-title">
                  <span className="quickopen-item-name">{item.name}</span>
                  <span className="quickopen-item-path">
                    {relDisplay}
                    {item.line && item.line > 1 ? `:${item.line}` : ''}
                  </span>
                  {item.isOpenTab && <span className="quickopen-badge">open</span>}
                </div>
                {item.preview && !item.preview.startsWith('[File]') && (
                  <div className="quickopen-item-preview">{item.preview}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
