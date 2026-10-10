import { useCallback, useEffect, useState } from 'react';
import { getConfig, getDrives, getFileTree, getRecentProjects, removeRecentProject, type RecentProject } from '../../api';
import { useWorkspaceStore } from '../../stores/workspace';
import type { DirEntry } from '../../types';

function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M1.5 3.5 a1 1 0 0 1 1 -1 h3 l1.5 1.5 h5.5 a1 1 0 0 1 1 1 v8 a1 1 0 0 1 -1 1 h-10 a1 1 0 0 1 -1 -1z" fill="#38bdf8" opacity="0.3" stroke="#38bdf8" strokeWidth="1.2" />
    </svg>
  );
}

function UpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function joinPath(base: string, name: string): string {
  const isWindows = base.includes('\\');
  const sep = isWindows ? '\\' : '/';
  if (base.endsWith(sep)) {
    return base + name;
  }
  return base + sep + name;
}

function getParentPath(dirPath: string): string {
  const isWindows = dirPath.includes('\\');
  const sep = isWindows ? '\\' : '/';
  const trimmed = dirPath.replace(/[/\\]+$/, '');
  const lastIndex = isWindows ? trimmed.lastIndexOf('\\') : trimmed.lastIndexOf('/');
  if (lastIndex <= 0) {
    return isWindows ? (trimmed.slice(0, 3) || 'C:\\') : '/';
  }
  return trimmed.slice(0, lastIndex) || sep;
}

export function ProjectPicker() {
  const addProject = useWorkspaceStore((s) => s.addProject);
  const projects = useWorkspaceStore((s) => s.projects);
  const setShowPicker = useWorkspaceStore((s) => s.setShowPicker);

  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [drives, setDrives] = useState<string[]>([]);
  const [rootPath, setRootPath] = useState('');
  const [pathInput, setPathInput] = useState('');
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canClose = projects.length > 0;

  useEffect(() => {
    document.title = '9ed - Open Folder';
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getRecentProjects()
      .then((recents) => {
        if (!cancelled) setRecentProjects(recents);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load recent projects');
      });
    return () => { cancelled = true; };
  }, []);

  const loadTree = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    setRootPath(path);
    setPathInput(path);
    try {
      const items = await getFileTree(path);
      const dirs = items
        .filter((e) => e.type === 'dir')
        .sort((a, b) => a.name.localeCompare(b.name));
      setEntries(dirs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to access directory');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const config = await getConfig();
        if (cancelled) return;
        const root = config.workspaceRoot || '/';
        await loadTree(root);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load');
          setLoading(false);
        }
      }
    }
    void init();

    void getDrives()
      .then((availableDrives) => {
        if (!cancelled) setDrives(availableDrives);
      })
      .catch(() => {
        if (!cancelled) setDrives([]);
      });

    return () => { cancelled = true; };
  }, [loadTree]);

  const handleSelectFolder = (folderPath: string, folderName?: string) => {
    const cleanPath = folderPath.trim();
    if (!cleanPath) return;
    const name = folderName?.trim() || cleanPath.split(/[/\\]/).filter(Boolean).pop() || 'Workspace';
    addProject(cleanPath, name);
    setShowPicker(false);
  };

  const handleGoUp = () => {
    if (!rootPath) return;
    const parent = getParentPath(rootPath);
    if (parent !== rootPath) {
      void loadTree(parent);
    }
  };

  const handlePathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pathInput.trim()) {
      void loadTree(pathInput.trim());
    }
  };

  const currentFolderName = rootPath.split(/[/\\]/).filter(Boolean).pop() || rootPath || 'Folder';

  return (
    <div
      className="picker-shell folder-picker-overlay"
      onClick={() => canClose && setShowPicker(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="folder-picker-title"
    >
      <div className="picker-card folder-picker-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="picker-header folder-picker-header">
          <div className="folder-picker-title-wrap">
            <h2 id="folder-picker-title" className="picker-modal-title folder-picker-title">
              Open Folder / Repository
            </h2>
            <span className="picker-modal-desc folder-picker-desc">
              Select a project folder on your system to work with
            </span>
          </div>
          {canClose && (
            <button
              type="button"
              className="picker-close-btn folder-picker-close-btn"
              onClick={() => setShowPicker(false)}
              title="Close (Esc)"
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>

        {/* Recent Projects (compact chips) */}
        {recentProjects.length > 0 && (
          <div className="folder-picker-recents">
            <span className="folder-picker-section-label">Recent</span>
            <div className="folder-picker-recents-list">
              {recentProjects.map((rp) => (
                <div key={rp.path} className="folder-picker-recent-chip">
                  <button
                    type="button"
                    className="folder-picker-recent-btn"
                    onClick={() => handleSelectFolder(rp.path, rp.name)}
                    title={rp.path}
                  >
                    <FolderIcon />
                    <span className="folder-picker-recent-name">{rp.name}</span>
                  </button>
                  <button
                    type="button"
                    className="folder-picker-recent-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      void removeRecentProject(rp.path).then(() => {
                        setRecentProjects((prev) => prev.filter((p) => p.path !== rp.path));
                      });
                    }}
                    title="Remove from recent"
                    aria-label={`Remove ${rp.name} from recent`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Drives selector (Windows / multi-mount) */}
        {drives.length > 1 && (
          <div className="drive-picker folder-picker-drives">
            <span className="drive-label">Drives</span>
            <div className="drive-list">
              {drives.map((drive) => (
                <button
                  key={drive}
                  type="button"
                  className={`drive-btn${drive === rootPath ? ' active' : ''}`}
                  onClick={() => void loadTree(drive)}
                >
                  {drive}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Path Navigation Bar */}
        <form className="folder-picker-path-bar" onSubmit={handlePathSubmit}>
          <button
            type="button"
            className="folder-picker-up-btn"
            onClick={handleGoUp}
            title="Go up to parent directory"
            aria-label="Up"
          >
            <UpIcon />
          </button>
          <input
            type="text"
            className="folder-picker-path-input"
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            placeholder="/path/to/folder"
            aria-label="Current path"
            spellCheck={false}
          />
          <button type="submit" className="folder-picker-go-btn">
            Go
          </button>
        </form>

        {/* Status / Error Banner */}
        {error && <div className="status-banner error folder-picker-status">{error}</div>}
        {loading && <div className="status-banner folder-picker-status">Loading directories…</div>}

        {/* Directory Listing */}
        <div className="folder-picker-list">
          {!loading && entries.length === 0 && !error && (
            <div className="folder-picker-empty">No subdirectories in this folder</div>
          )}
          {entries.map((dir) => {
            const childPath = joinPath(rootPath, dir.name);
            return (
              <div key={dir.name} className="folder-picker-item">
                <button
                  type="button"
                  className="folder-picker-item-nav"
                  onClick={() => void loadTree(childPath)}
                  title={`Enter ${dir.name}`}
                >
                  <FolderIcon />
                  <span className="folder-picker-item-name">{dir.name}</span>
                </button>
                <button
                  type="button"
                  className="folder-picker-select-btn"
                  onClick={() => handleSelectFolder(childPath, dir.name)}
                  title={`Select folder ${dir.name}`}
                >
                  Select
                </button>
              </div>
            );
          })}
        </div>

        {/* Action Footer */}
        <div className="folder-picker-footer">
          <div className="folder-picker-footer-left">
            <span className="folder-picker-footer-path" title={rootPath}>
              {rootPath}
            </span>
          </div>
          <div className="folder-picker-footer-actions">
            {canClose && (
              <button
                type="button"
                className="folder-picker-btn-secondary"
                onClick={() => setShowPicker(false)}
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              className="folder-picker-btn-primary"
              disabled={loading || !rootPath}
              onClick={() => handleSelectFolder(rootPath, currentFolderName)}
            >
              Select Current Folder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
