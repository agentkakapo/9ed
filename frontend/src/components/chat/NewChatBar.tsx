import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useWorkspaceStore } from '../../stores/workspace';
import { useGitStore } from '../../stores/git';
import { gitBranchAction } from '../../api';

export function ClaudeMascot() {
  return (
    <div className="new-chat-mascot-wrap" title="Claude" aria-hidden="true">
      <svg
        width="20"
        height="16"
        viewBox="0 0 10 8"
        fill="#d97757"
        style={{ shapeRendering: 'crispEdges' }}
      >
        {/* Row 0: head top */}
        <rect x="3" y="0" width="4" height="1" />
        {/* Row 1: forehead */}
        <rect x="1" y="1" width="8" height="1" />
        {/* Row 2: ears + eyes (eyes cut at x=2 and x=7) */}
        <rect x="0" y="2" width="2" height="1" />
        <rect x="3" y="2" width="4" height="1" />
        <rect x="8" y="2" width="2" height="1" />
        {/* Row 3: face */}
        <rect x="0" y="3" width="10" height="1" />
        {/* Row 4: body */}
        <rect x="1" y="4" width="8" height="1" />
        {/* Rows 5-7: 4 legs */}
        <rect x="1" y="5" width="1" height="3" />
        <rect x="3" y="5" width="1" height="3" />
        <rect x="6" y="5" width="1" height="3" />
        <rect x="8" y="5" width="1" height="3" />
      </svg>
    </div>
  );
}

function CloudIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function BranchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

type MenuType = 'location' | 'project' | 'branch' | 'plus' | null;

export function NewChatBar() {
  const projects = useWorkspaceStore((s) => s.projects);
  const activeProjectId = useWorkspaceStore((s) => s.activeProjectId);
  const setActiveProject = useWorkspaceStore((s) => s.setActiveProject);
  const setShowPicker = useWorkspaceStore((s) => s.setShowPicker);
  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? projects[0] ?? null,
    [projects, activeProjectId],
  );

  const branches = useGitStore((s) => s.branches);
  const refreshGit = useGitStore((s) => s.refresh);
  const [location, setLocation] = useState<'Default' | 'Cloud'>('Default');
  const [openMenu, setOpenMenu] = useState<MenuType>(null);
  const [overlayStyle, setOverlayStyle] = useState<React.CSSProperties>({});
  const [showCloudInfo, setShowCloudInfo] = useState(false);

  const locationBtnRef = useRef<HTMLButtonElement | null>(null);
  const projectBtnRef = useRef<HTMLButtonElement | null>(null);
  const branchBtnRef = useRef<HTMLButtonElement | null>(null);
  const plusBtnRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Refresh git when activeProject changes
  useEffect(() => {
    if (activeProject?.path) {
      void refreshGit(activeProject.path);
    }
  }, [activeProject?.path, refreshGit]);

  const currentBranch = useMemo(
    () => branches.find((b) => b.current)?.name ?? 'main',
    [branches],
  );

  // Positioning the dropdown overlay right above or below the trigger
  useLayoutEffect(() => {
    if (!openMenu) return;

    const updatePosition = () => {
      let trigger: HTMLButtonElement | null = null;
      if (openMenu === 'location') trigger = locationBtnRef.current;
      else if (openMenu === 'project') trigger = projectBtnRef.current;
      else if (openMenu === 'branch') trigger = branchBtnRef.current;
      else if (openMenu === 'plus') trigger = plusBtnRef.current;

      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const width = openMenu === 'project' ? 320 : openMenu === 'branch' ? 240 : 200;
      let left = rect.left;
      if (left + width > window.innerWidth - 12) {
        left = window.innerWidth - width - 12;
      }
      if (left < 12) left = 12;

      const gap = 6;
      const spaceAbove = Math.max(60, rect.top - 20);
      const spaceBelow = Math.max(60, window.innerHeight - rect.bottom - 20);
      const openUp = spaceAbove >= 180 || spaceAbove > spaceBelow;
      const maxHeight = Math.min(360, Math.max(120, openUp ? spaceAbove : spaceBelow));

      if (openUp) {
        setOverlayStyle({
          position: 'fixed',
          left: `${Math.round(left)}px`,
          bottom: `${Math.round(window.innerHeight - rect.top + gap)}px`,
          width: `${width}px`,
          maxHeight: `${Math.round(maxHeight)}px`,
          overflowY: 'auto',
          overflowX: 'hidden',
          zIndex: 10000,
        });
      } else {
        setOverlayStyle({
          position: 'fixed',
          left: `${Math.round(left)}px`,
          top: `${Math.round(rect.bottom + gap)}px`,
          width: `${width}px`,
          maxHeight: `${Math.round(maxHeight)}px`,
          overflowY: 'auto',
          overflowX: 'hidden',
          zIndex: 10000,
        });
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [openMenu]);

  // Click outside listener
  useEffect(() => {
    if (!openMenu) return;
    const handleDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (dropdownRef.current?.contains(target)) return;
      if (locationBtnRef.current?.contains(target)) return;
      if (projectBtnRef.current?.contains(target)) return;
      if (branchBtnRef.current?.contains(target)) return;
      if (plusBtnRef.current?.contains(target)) return;
      setOpenMenu(null);
    };
    document.addEventListener('mousedown', handleDown);
    return () => document.removeEventListener('mousedown', handleDown);
  }, [openMenu]);

  const handleSwitchBranch = async (branchName: string) => {
    if (!activeProject) return;
    try {
      await gitBranchAction(activeProject.path, 'checkout', branchName);
      await refreshGit(activeProject.path);
    } catch (err) {
      console.error('Failed to checkout branch:', err);
    }
    setOpenMenu(null);
  };

  const handleCreateBranch = async () => {
    if (!activeProject) return;
    const name = window.prompt('Enter new branch name:');
    if (!name || !name.trim()) return;
    try {
      await gitBranchAction(activeProject.path, 'create', name.trim());
      await gitBranchAction(activeProject.path, 'checkout', name.trim());
      await refreshGit(activeProject.path);
    } catch (err) {
      console.error('Failed to create branch:', err);
    }
    setOpenMenu(null);
  };

  const renderDropdown = () => {
    if (!openMenu) return null;

    let content: React.ReactNode = null;

    if (openMenu === 'location') {
      content = (
        <div className="picker-dropdown picker-dropdown-overlay" ref={dropdownRef} style={overlayStyle}>
          <button
            type="button"
            className="picker-dropdown-item"
            data-active={location === 'Default' ? 'true' : 'false'}
            onClick={() => {
              setLocation('Default');
              setOpenMenu(null);
            }}
          >
            <CloudIcon />
            <span>Default (Local machine)</span>
          </button>
          <button
            type="button"
            className="picker-dropdown-item"
            data-active={location === 'Cloud' ? 'true' : 'false'}
            onClick={() => {
              setLocation('Cloud');
              setOpenMenu(null);
              setShowCloudInfo(true);
            }}
          >
            <CloudIcon />
            <span>Cloud Environment</span>
          </button>
        </div>
      );
    } else if (openMenu === 'project') {
      content = (
        <div className="picker-dropdown picker-dropdown-overlay" ref={dropdownRef} style={overlayStyle}>
          <div className="new-chat-dropdown-header">Repositories &amp; Projects</div>
          {projects.length > 0 ? (
            <div className="new-chat-repo-list">
              {projects.map((proj) => {
                const isActive = proj.id === activeProject?.id;
                return (
                  <button
                    key={proj.id}
                    type="button"
                    className="new-chat-repo-item"
                    data-active={isActive ? 'true' : 'false'}
                    onClick={() => {
                      setActiveProject(proj.id);
                      setOpenMenu(null);
                    }}
                  >
                    <div className="new-chat-repo-left">
                      <CodeIcon />
                      <div className="new-chat-repo-details">
                        <span className="new-chat-repo-name">{proj.name}</span>
                        <span className="new-chat-repo-path" title={proj.path}>{proj.path}</span>
                      </div>
                    </div>
                    {isActive && (
                      <span className="new-chat-repo-check" aria-hidden="true">
                        <CheckIcon />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="new-chat-dropdown-empty">No repositories open</div>
          )}
          <div className="new-chat-dropdown-divider" />
          <button
            type="button"
            className="new-chat-repo-action-btn"
            onClick={() => {
              setOpenMenu(null);
              setShowPicker(true);
            }}
          >
            <PlusIcon />
            <span>New repo...</span>
          </button>
        </div>
      );
    } else if (openMenu === 'branch') {
      content = (
        <div className="picker-dropdown picker-dropdown-overlay" ref={dropdownRef} style={overlayStyle}>
          <div className="new-chat-dropdown-header">Git Branches</div>
          {branches.length > 0 ? (
            <div className="new-chat-repo-list">
              {branches.map((b) => (
                <button
                  key={b.name}
                  type="button"
                  className="picker-dropdown-item"
                  data-active={b.name === currentBranch ? 'true' : 'false'}
                  onClick={() => void handleSwitchBranch(b.name)}
                >
                  <BranchIcon />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="picker-dropdown-empty">No git branches found</div>
          )}
          <div className="new-chat-dropdown-divider" />
          <button
            type="button"
            className="new-chat-repo-action-btn"
            onClick={() => void handleCreateBranch()}
          >
            <PlusIcon />
            <span>Create new branch...</span>
          </button>
        </div>
      );
    } else if (openMenu === 'plus') {
      content = (
        <div className="picker-dropdown picker-dropdown-overlay" ref={dropdownRef} style={overlayStyle}>
          <button
            type="button"
            className="picker-dropdown-item"
            onClick={() => {
              setOpenMenu(null);
              setShowPicker(true);
            }}
          >
            <PlusIcon />
            <span>New repo...</span>
          </button>
          <button
            type="button"
            className="picker-dropdown-item"
            onClick={() => void handleCreateBranch()}
          >
            <BranchIcon />
            <span>New branch...</span>
          </button>
          <button
            type="button"
            className="picker-dropdown-item"
            onClick={() => {
              setOpenMenu(null);
              setShowCloudInfo(true);
            }}
          >
            <CloudIcon />
            <span>Cloud session info</span>
          </button>
        </div>
      );
    }

    return createPortal(content, document.body);
  };

  return (
    <div className="new-chat-top-bar">
      <div className="new-chat-pills-row">
        {/* 1. Location Pill */}
        <button
          ref={locationBtnRef}
          type="button"
          className={`new-chat-pill-btn${openMenu === 'location' ? ' active' : ''}`}
          onClick={() => setOpenMenu(openMenu === 'location' ? null : 'location')}
          title="Select execution environment"
          aria-haspopup="menu"
          aria-expanded={openMenu === 'location'}
        >
          <CloudIcon />
          <span>{location}</span>
        </button>

        {/* 2. Project Pill */}
        <button
          ref={projectBtnRef}
          type="button"
          className={`new-chat-pill-btn${openMenu === 'project' ? ' active' : ''}`}
          onClick={() => setOpenMenu(openMenu === 'project' ? null : 'project')}
          title="Select workspace project"
          aria-haspopup="menu"
          aria-expanded={openMenu === 'project'}
        >
          <CodeIcon />
          <span>{activeProject?.name ?? 'Select project'}</span>
        </button>

        {/* 3. Branch Pill */}
        <button
          ref={branchBtnRef}
          type="button"
          className={`new-chat-pill-btn${openMenu === 'branch' ? ' active' : ''}`}
          onClick={() => setOpenMenu(openMenu === 'branch' ? null : 'branch')}
          title="Select git branch"
          aria-haspopup="menu"
          aria-expanded={openMenu === 'branch'}
        >
          <BranchIcon />
          <span>{currentBranch}</span>
        </button>

        {/* 4. Plus Pill */}
        <button
          ref={plusBtnRef}
          type="button"
          className={`new-chat-pill-btn new-chat-plus-btn${openMenu === 'plus' ? ' active' : ''}`}
          onClick={() => setOpenMenu(openMenu === 'plus' ? null : 'plus')}
          title="More options"
          aria-haspopup="menu"
          aria-expanded={openMenu === 'plus'}
        >
          +
        </button>
      </div>

      {/* Retro 8-bit Mascot */}
      <ClaudeMascot />

      {renderDropdown()}

      {showCloudInfo && (
        <div className="chat-modal-backdrop" onClick={() => setShowCloudInfo(false)}>
          <div className="chat-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="chat-modal-header">
              <span className="chat-modal-title">Cloud Sessions in 9ed</span>
              <button
                type="button"
                className="chat-modal-close"
                onClick={() => setShowCloudInfo(false)}
              >
                ×
              </button>
            </div>
            <div className="chat-modal-body">
              <p>
                <strong>9ed supports cloud execution in multiple ways:</strong>
              </p>
              <ul>
                <li>
                  <strong>Built-in Tunneling:</strong> 9ed includes integrated Cloudflare and Bore tunnels (<code>TUNNEL=true</code>), allowing you to run 9ed on any remote VM or server and access it securely from anywhere via HTTPS.
                </li>
                <li>
                  <strong>Cloud Hosted Binary:</strong> Build a self-contained release binary (<code>npm run binary:build</code>) and deploy it to AWS, GCP, Fly.io, or any container runner for full cloud workspaces.
                </li>
                <li>
                  <strong>Remote Agent Protocol:</strong> The Agent Client Protocol (ACP) can connect over WebSocket or SSH to remote daemon runners.
                </li>
              </ul>
            </div>
            <div className="chat-modal-footer">
              <button
                type="button"
                className="chat-modal-btn-primary"
                onClick={() => setShowCloudInfo(false)}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
