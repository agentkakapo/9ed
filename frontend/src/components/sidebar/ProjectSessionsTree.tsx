import { useEffect, useState, useMemo } from 'react';
import { useWorkspaceStore } from '../../stores/workspace';
import { normalizeWorkDir, sessionBelongsToWorkDir, useChatStore } from '../../stores/chat';
import { deleteChatSession } from '../../api';

const agentLabels: Record<string, string> = {
  antigravity: 'Google Antigravity',
  claude: 'Claude Code',
  codex: 'Codex CLI',
  gemini: 'Gemini CLI',
  opencode: 'OpenCode',
  pi: 'Pi',
  amp: 'Amp',
  copilot: 'Copilot',
};

const agentGlyphs: Record<string, string> = {
  antigravity: '◈',
  claude: '⚑',
  codex: '⚡',
  gemini: '✦',
  pi: 'π',
  amp: '▲',
  copilot: '⬡',
  opencode: '⌥',
};

const agentColors: Record<string, string> = {
  antigravity: '#38bdf8', // cyan
  claude: '#f59e0b',      // amber
  codex: '#10b981',       // emerald
  gemini: '#60a5fa',      // sky blue
  opencode: '#818cf8',    // indigo
  pi: '#c084fc',          // purple
  amp: '#f43f5e',         // rose
  copilot: '#3b82f6',     // blue
};

function formatSessionTitle(agentId: string, title?: string): string {
  const agent = agentLabels[agentId] ?? agentId;
  if (!title || title === agent) return agent;
  return title;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ProjectSessionsTree() {
  const projects = useWorkspaceStore((s) => s.projects);
  const activeProjectId = useWorkspaceStore((s) => s.activeProjectId);
  const setActiveProject = useWorkspaceStore((s) => s.setActiveProject);
  const removeProject = useWorkspaceStore((s) => s.removeProject);

  const sessions = useChatStore((s) => s.sessions);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const setActiveSession = useChatStore((s) => s.setActiveSession);
  const deleteSessionStore = useChatStore((s) => s.deleteSession);
  const historySessions = useChatStore((s) => s.historySessions);
  const historyLoaded = useChatStore((s) => s.historyLoaded);
  const loadHistory = useChatStore((s) => s.loadHistory);
  const loadHistorySession = useChatStore((s) => s.loadHistorySession);
  const deleteHistorySession = useChatStore((s) => s.deleteHistorySession);

  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);

  // Load history across workspace
  useEffect(() => {
    if (!historyLoaded) {
      loadHistory().catch(() => {});
    }
  }, [historyLoaded, loadHistory]);

  const toggleProject = (projectId: string) => {
    setCollapsedProjects((prev) => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  const startNewChat = useChatStore((s) => s.startNewChat);

  const handleStartChat = (projectId: string, _projectPath: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    startNewChat(projectId);
  };

  const handleSelectSession = (projectId: string, sessionId: string) => {
    if (activeProjectId !== projectId) {
      setActiveProject(projectId);
    }
    setActiveSession(sessionId);
  };

  const handleSelectHistorySession = async (projectId: string, historyId: string) => {
    if (activeProjectId !== projectId) {
      setActiveProject(projectId);
    }
    setLoadingSessionId(historyId);
    try {
      await loadHistorySession(historyId);
    } finally {
      setLoadingSessionId(null);
    }
  };

  const handleDeleteLiveSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteChatSession(sessionId).catch(() => {});
    deleteSessionStore(sessionId);
  };

  const handleDeleteHistorySession = (historyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteHistorySession(historyId);
  };

  // Find any history sessions not tied to current open projects
  const openProjectPaths = useMemo(() => new Set(projects.map((p) => normalizeWorkDir(p.path)).filter(Boolean)), [projects]);
  const orphanedHistory = useMemo(() => {
    return historySessions.filter((h) => {
      const norm = normalizeWorkDir(h.workDir);
      return !norm || !openProjectPaths.has(norm);
    });
  }, [historySessions, openProjectPaths]);

  return (
    <div className="project-sessions-tree">
      <div className="project-tree-top-bar">
        <span className="project-tree-heading">Open Projects</span>
      </div>

      {projects.map((project) => {
        const isCollapsed = !!collapsedProjects[project.id];
        const isActiveProject = project.id === activeProjectId;
        const liveSessions = sessions.filter((s) => sessionBelongsToWorkDir(s, project.path));
        const activeIds = new Set(liveSessions.flatMap((s) => [s.id, s.recordId].filter((id): id is string => Boolean(id))));
        const activeAcpIds = new Set(liveSessions.map((s) => s.acpSessionId).filter(Boolean));
        const histSessions = historySessions.filter((h) =>
          sessionBelongsToWorkDir(h, project.path) &&
          !activeIds.has(h.id) &&
          (!h.acpSessionId || !activeAcpIds.has(h.acpSessionId))
        );

        const totalSessions = liveSessions.length + histSessions.length;

        return (
          <div key={project.id} className={`project-session-group${isActiveProject ? ' is-active-project' : ''}`}>
            <div
              className="project-group-header"
              onClick={() => {
                if (!isActiveProject) setActiveProject(project.id);
                toggleProject(project.id);
              }}
              title={project.path}
            >
              <button
                type="button"
                className={`project-chevron${isCollapsed ? ' collapsed' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleProject(project.id);
                }}
                aria-label={isCollapsed ? 'Expand project' : 'Collapse project'}
              >
                ▾
              </button>
              <span className="project-folder-icon" aria-hidden="true">📁</span>
              <span className="project-group-name">{project.name}</span>
              <span className="project-session-count">{totalSessions}</span>
              <div className="project-group-actions">
                <button
                  type="button"
                  className="project-add-chat-btn"
                  onClick={(e) => void handleStartChat(project.id, project.path, e)}
                  title={`Start new chat in ${project.name}`}
                >
                  +
                </button>
                <button
                  type="button"
                  className="project-close-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeProject(project.id);
                  }}
                  title={`Close project ${project.name}`}
                >
                  ×
                </button>
              </div>
            </div>

            {!isCollapsed && (
              <div className="project-sessions-list">
                {liveSessions.map((session) => {
                  const isActive = session.id === activeSessionId && isActiveProject;
                  const glyph = agentGlyphs[session.agentId] ?? '◈';
                  const color = agentColors[session.agentId] ?? '#38bdf8';
                  const isStreaming = session.status === 'streaming';
                  const isConnecting = session.status === 'connecting';
                  const isError = session.status === 'error' || session.crashed;

                  return (
                    <div
                      key={session.id}
                      className={`session-tree-item live${isActive ? ' active' : ''}`}
                      onClick={() => handleSelectSession(project.id, session.id)}
                      title={`${session.agentId} • ${session.title}`}
                    >
                      <span className="session-tree-glyph" style={{ color }} aria-hidden="true">
                        {glyph}
                      </span>
                      <span className="session-tree-title">
                        {formatSessionTitle(session.agentId, session.title)}
                      </span>
                      <div className="session-tree-meta">
                        {isStreaming ? (
                          <span className="session-pulse-dot" title="Working..." />
                        ) : isConnecting ? (
                          <span className="session-status-connecting" title="Connecting">○</span>
                        ) : isError ? (
                          <span className="session-status-error" title="Error">!</span>
                        ) : (
                          <span className="session-relative-time">{formatRelativeTime(session.createdAt)}</span>
                        )}
                        <button
                          type="button"
                          className="session-tree-delete-btn"
                          onClick={(e) => handleDeleteLiveSession(session.id, e)}
                          title="Delete chat"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}

                {histSessions.map((hist) => {
                  const glyph = agentGlyphs[hist.agentId] ?? '◈';
                  const color = agentColors[hist.agentId] ?? '#94a3b8';
                  const isLoading = loadingSessionId === hist.id;

                  return (
                    <div
                      key={hist.id}
                      className={`session-tree-item history${isLoading ? ' loading' : ''}`}
                      onClick={() => void handleSelectHistorySession(project.id, hist.id)}
                      title={`History: ${hist.agentId} • ${hist.title}`}
                    >
                      <span className="session-tree-glyph" style={{ color }} aria-hidden="true">
                        {glyph}
                      </span>
                      <span className="session-tree-title history-title">
                        {formatSessionTitle(hist.agentId, hist.title)}
                      </span>
                      <div className="session-tree-meta">
                        {isLoading ? (
                          <span className="chat-connecting-spinner chat-inline-spinner" />
                        ) : hist.acpSessionId ? (
                          <span className="session-resumable-icon" title="Resumable ACP session">↻</span>
                        ) : (
                          <span className="session-relative-time">{formatRelativeTime(hist.updatedAt)}</span>
                        )}
                        <button
                          type="button"
                          className="session-tree-delete-btn"
                          onClick={(e) => handleDeleteHistorySession(hist.id, e)}
                          title="Delete from history"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}

                {totalSessions === 0 && (
                  <div className="project-sessions-empty">
                    <span>No chats yet</span>
                    <button
                      type="button"
                      className="project-empty-create-btn"
                      onClick={() => void handleStartChat(project.id, project.path)}
                    >
                      + Start chat
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {projects.length === 0 && (
        <div className="project-sessions-no-projects">
          <p>No open projects.</p>
        </div>
      )}

      {orphanedHistory.length > 0 && (
        <div className="project-session-group orphaned-group">
          <div className="project-group-header">
            <span className="project-folder-icon">◷</span>
            <span className="project-group-name">Past Sessions</span>
            <span className="project-session-count">{orphanedHistory.length}</span>
          </div>
          <div className="project-sessions-list">
            {orphanedHistory.map((hist: import('../../types').HistorySessionRecord) => {
              const glyph = agentGlyphs[hist.agentId] ?? '◈';
              return (
                <div
                  key={hist.id}
                  className="session-tree-item history"
                  onClick={() => {
                    if (activeProjectId) {
                      void handleSelectHistorySession(activeProjectId, hist.id);
                    }
                  }}
                  title={hist.title}
                >
                  <span className="session-tree-glyph" style={{ color: '#64748b' }}>{glyph}</span>
                  <span className="session-tree-title history-title">{hist.title}</span>
                  <button
                    type="button"
                    className="session-tree-delete-btn"
                    onClick={(e) => handleDeleteHistorySession(hist.id, e)}
                    title="Delete from history"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
