import { useEffect, useRef, useState } from 'react';
import { normalizeWorkDir, sessionBelongsToWorkDir, useChatStore } from '../../stores/chat';
import { useWorkspaceStore } from '../../stores/workspace';
import { useChatSession } from '../../hooks/useChatSession';
import { getChatAgents, createChatSession } from '../../api';
import { ChatMessage, describeToolStep } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ChatQueue } from './ChatQueue';
import { PermissionDialog } from './PermissionDialog';
import { ConfigBar } from './AgentPicker';
import { ChatSessionList } from './ChatSessionList';
import { NewChatBar } from './NewChatBar';
import type { ChatSessionInfo } from '../../types';

function NewChatHero({ onPromptSelect }: { onPromptSelect: (text: string) => void }) {
  const suggestions = [
    { title: 'Explain this codebase', desc: 'Overview of project structure and architecture' },
    { title: 'Find bugs & edge cases', desc: 'Inspect recent changes and spot potential issues' },
    { title: 'Run tests & fix errors', desc: 'Execute the test suite and resolve failures' },
    { title: 'Implement a new feature', desc: 'Plan and write code with full test coverage' },
  ];

  return (
    <div className="new-chat-hero">
      <div className="new-chat-hero-icon" aria-hidden="true">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d97757" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" stroke="#d97757" strokeOpacity="0.3" strokeWidth="1" fill="#d97757" fillOpacity="0.08" />
          <path d="m10 15 5-3-5-3v6Z" fill="#d97757" stroke="none" />
        </svg>
      </div>
      <h2 className="new-chat-hero-title">What can I help you build?</h2>
      <p className="new-chat-hero-subtitle">
        Select a project and branch below, or start with a common task:
      </p>
      <div className="new-chat-suggestions-grid">
        {suggestions.map((s) => (
          <button
            key={s.title}
            type="button"
            className="new-chat-suggestion-card"
            onClick={() => onPromptSelect(s.title)}
          >
            <span className="suggestion-card-title">{s.title}</span>
            <span className="suggestion-card-desc">{s.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const AGENT_RETRY_DELAYS_MS = [500, 1500, 4000];

function formatDebugTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function ChatDebugIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
      <path d="M7 4h6l1 2h2a1 1 0 0 1 1 1v6a3 3 0 0 1-3 3h-1l-2 2h-2l-2-2H6a3 3 0 0 1-3-3V7a1 1 0 0 1 1-1h2l1-2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="8" cy="10" r="1.2" fill="currentColor" />
      <circle cx="12" cy="10" r="1.2" fill="currentColor" />
    </svg>
  );
}

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

function SidebarToggleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <line x1="8" y1="3" x2="8" y2="17" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export type ChatPanelProps = {
  auxiliaryToggles?: React.ReactNode;
  onToggleSidebar?: () => void;
  sidebarVisible?: boolean;
};

export function ChatPanel({ auxiliaryToggles, onToggleSidebar, sidebarVisible }: ChatPanelProps = {}) {
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const activeProject = useWorkspaceStore((s) => s.projects.find((p) => p.id === s.activeProjectId) ?? null);
  const agents = useChatStore((s) => s.agents);
  const sessions = useChatStore((s) => s.sessions);
  const historySessions = useChatStore((s) => s.historySessions);
  const loadHistorySession = useChatStore((s) => s.loadHistorySession);
  const activeSessionByWorkDir = useChatStore((s) => s.activeSessionByWorkDir);
  const selectedAgentId = useChatStore((s) => s.selectedAgentId);
  const setSelectedAgent = useChatStore((s) => s.setSelectedAgent);
  const useActiveTerminal = useChatStore((s) => s.useActiveTerminal);
  const useActiveBrowser = useChatStore((s) => s.useActiveBrowser);
  const activeTerminalId = useChatStore((s) => s.activeTerminalId);
  const browserSelection = useChatStore((s) => s.browserSelection);
  const browserSelectionMode = useChatStore((s) => s.browserSelectionMode);
  const browserSelectionCapture = useChatStore((s) => s.browserSelectionCapture);
  const loadAgents = useChatStore((s) => s.loadAgents);
  const createSessionStore = useChatStore((s) => s.createSession);
  const setActiveSession = useChatStore((s) => s.setActiveSession);
  const resumeSession = useChatStore((s) => s.resumeSession);
  const restoring = useChatStore((s) => s.restoring);
  const lastRestoreError = useChatStore((s) => s.lastRestoreError);
  const { sendMessage, cancel, setConfigOption, respondPermission, rejectPermission, setAutoApprove, connected } = useChatSession();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const autoResumeKeysRef = useRef<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [agentsLoading, setAgentsLoading] = useState(agents.length === 0);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [showChatDebugPanel, setShowChatDebugPanel] = useState(false);

  const projectSessions = sessions.filter((session) => sessionBelongsToWorkDir(session, activeProject?.path));
  const activeSession = projectSessions.find((sess) => sess.id === activeSessionId) ?? null;
  const projectWorkDirKey = normalizeWorkDir(activeProject?.path);
  const rememberedProjectSessionId = projectWorkDirKey ? activeSessionByWorkDir[projectWorkDirKey] : undefined;
  const projectSessionIds = projectSessions.map((session) => session.id).join('|');
  const isStreaming = activeSession?.status === 'streaming';
  const isConnecting = activeSession?.status === 'connecting' || creating;
  // ADR-0004: reconnecting is true while a crash-recovery resume request is
  // in flight (status flips to 'connecting' via resumeSession).
  const reconnecting = !!activeSession && activeSession.status === 'connecting' && activeSession.crashed;
  const isArchived = activeSession?.kind === 'archived';
  const canResumeArchived = Boolean(activeSession?.kind === 'archived' && activeSession.agentId && activeSession.workDir);
  // ADR-0005 VAL-PTY-007: pass the lock holder so ChatInput disables + shows banner.
  const lockedBy = activeSession?.inputLocked ? activeSession.lockedBy : undefined;
  const isNewChat = useChatStore((s) => s.isNewChat);
  const showConfigBar = !isArchived || isConnecting || restoring || !activeSession;
  const lastLiveToolCall = activeSession
    ? [...activeSession.messages].reverse().find((message) => message.role === 'tool_call' && message.toolCall)
    : undefined;
  const liveStepLabel = lastLiveToolCall?.toolCall ? describeToolStep(lastLiveToolCall.toolCall) : null;
  const configBusyLabel = restoring
    ? 'Restoring session...'
    : creating
      ? 'Creating agent session...'
      : (activeSession?.status === 'connecting' ? 'Reconnecting session...' : null);
  const debugEntries = activeSession?.debugEntries ?? [];
  const lastEventAgoSeconds = activeSession?.lastEventAt ? Math.max(0, Math.round((Date.now() - activeSession.lastEventAt) / 1000)) : null;

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const load = async (attempt: number) => {
      if (cancelled) return;
      if (attempt === 0) setAgentsLoading(true);
      try {
        const nextAgents = await getChatAgents();
        if (cancelled) return;
        loadAgents(nextAgents);
        setAgentsError(null);
        setAgentsLoading(false);
        if (nextAgents.length === 0 && attempt < AGENT_RETRY_DELAYS_MS.length) {
          retryTimer = setTimeout(() => void load(attempt + 1), AGENT_RETRY_DELAYS_MS[attempt]);
        }
      } catch (err) {
        if (cancelled) return;
        setAgentsError(err instanceof Error ? err.message : 'Failed to load agents');
        if (attempt < AGENT_RETRY_DELAYS_MS.length) {
          retryTimer = setTimeout(() => void load(attempt + 1), AGENT_RETRY_DELAYS_MS[attempt]);
          return;
        }
        setAgentsLoading(false);
      }
    };

    void load(0);
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [loadAgents]);

  useEffect(() => {
    if (!activeSession || activeSession.status !== 'idle') return;
    if (activeSession.kind !== 'archived' || !activeSession.agentId || !activeSession.workDir) return;
    const resumeKey = activeSession.recordId ?? activeSession.id;
    if (autoResumeKeysRef.current.has(resumeKey)) return;
    autoResumeKeysRef.current.add(resumeKey);
    void resumeSession(activeSession.id).finally(() => {
      autoResumeKeysRef.current.delete(resumeKey);
    });
  }, [activeSession?.id, activeSession?.recordId, activeSession?.kind, activeSession?.status, activeSession?.agentId, activeSession?.workDir, resumeSession]);

  useEffect(() => {
    if (!activeProject) return;
    if (activeSession) return;
    if (isNewChat) return;

    const remembered = projectSessions.find((session) => session.id === rememberedProjectSessionId);
    const fallback = remembered ?? projectSessions[projectSessions.length - 1] ?? null;
    if ((activeSessionId ?? null) !== (fallback?.id ?? null)) {
      setActiveSession(fallback?.id ?? null);
      return;
    }

    if (projectSessions.length === 0 && !restoring) {
      const projectHistory = historySessions.filter((h) => sessionBelongsToWorkDir(h, activeProject.path));
      if (projectHistory.length > 0) {
        const latest = projectHistory[0];
        if (latest && !autoResumeKeysRef.current.has(latest.id)) {
          autoResumeKeysRef.current.add(latest.id);
          void loadHistorySession(latest.id).catch(() => {});
        }
      }
    }
  }, [activeProject?.path, activeSession, activeSessionId, historySessions, isNewChat, loadHistorySession, projectSessionIds, projectSessions, rememberedProjectSessionId, restoring, setActiveSession]);

  const messages = activeSession?.messages;
  const lastMsgContent = messages?.[messages.length - 1]?.content;
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages?.length, lastMsgContent]);

  useEffect(() => {
    if (activeSession?.stalled) {
      setShowChatDebugPanel(true);
    }
  }, [activeSession?.stalled]);

  const handleSend = async (content: string, attachments?: import('./ChatInput').Attachment[]) => {
    if (!activeSession) {
      const available = agents.filter((a) => a.available);
      const agentId = (selectedAgentId && agents.some((a) => a.id === selectedAgentId && a.available))
        ? selectedAgentId
        : (available[0]?.id ?? 'antigravity');

      const agent = agents.find((a) => a.id === agentId);
      if (!agent) return;

      setSelectedAgent(agentId);
      setCreating(true);
      try {
        const terminalEnabled = useActiveTerminal && !!activeTerminalId;
        const browserTabId = activeProject?.activeBrowserTabId ?? null;
        const browserEnabled = useActiveBrowser && !!browserTabId;
        const draftConfig = useChatStore.getState().draftConfigByAgent[agentId];
        const draftModel = draftConfig?.['model'];
        const effectiveConfigOptions = useChatStore.getState().getEffectiveConfigOptions(agentId);
        const created = draftModel
          ? await createChatSession(agentId, activeProject?.path, terminalEnabled, terminalEnabled ? activeTerminalId : undefined, browserEnabled, browserTabId, draftModel)
          : await createChatSession(agentId, activeProject?.path, terminalEnabled, terminalEnabled ? activeTerminalId : undefined, browserEnabled, browserTabId);
        const session: ChatSessionInfo = {
          id: created.id,
          recordId: created.resumedFrom ?? created.id,
          agentId,
          title: content.slice(0, 32) || agent.label || 'Chat',
          messages: [],
          status: 'idle',
          createdAt: Date.now(),
          kind: 'live',
          workDir: created.workDir ?? activeProject?.path,
          acpSessionId: created.acpSessionId,
          configOptions: effectiveConfigOptions,
          useActiveTerminal: terminalEnabled,
          terminalId: terminalEnabled ? activeTerminalId : undefined,
          useActiveBrowser: browserEnabled,
          browserSelection: browserEnabled ? browserSelection : null,
          browserSelectionMode,
          browserSelectionCapture: browserEnabled ? browserSelectionCapture : null,
        };
        createSessionStore(session);
        setActiveSession(session.id);
        useChatStore.getState().cancelNewChat();
        void sendMessage(content, undefined, attachments);
      } catch (err) {
        console.error('Failed to auto-create chat session on send:', err);
      } finally {
        setCreating(false);
      }
      return;
    }
    sendMessage(content, undefined, attachments);
  };

  // ADR-0004 / VAL-RESUME-005: recover a crashed agent session. The backend
  // emits a done event with stopReason='agent_crash_unrecoverable' when the
  // subprocess cannot be auto-restarted; the reconnect button triggers an
  // explicit resume (HTTP POST /api/chat/sessions/resume), which re-resumes
  // the ACP session or falls back to a fresh Create. resumeSession surfaces
  // failures via lastRestoreError (shown in the banner below).
  const handleReconnect = () => {
    if (!activeSession) return;
    void resumeSession(activeSession.id);
  };

  if (agents.length === 0 && !activeSession && !restoring) {
    return (
      <div className="chat-panel">
        <div className="chat-empty">{agentsLoading ? 'Loading agents...' : (agentsError ?? 'No agents available')}</div>
      </div>
    );
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-tab-session-area">
          {!sidebarVisible && onToggleSidebar && (
            <button
              className="topbar-btn sidebar-expand-btn"
              onClick={onToggleSidebar}
              type="button"
              title="Expand sidebar (Ctrl+B)"
            >
              <SidebarToggleIcon />
            </button>
          )}
          <div className="center-session-info">
            <span className="session-project-tag">{activeProject?.name ?? '9ed'}</span>
            <span className="session-title-divider">/</span>
            <span className="session-title-text">{activeSession ? (activeSession.title || 'Chat') : 'New Chat'}</span>
            {activeSession && (
              <span className="center-agent-badge" data-agent={activeSession.agentId}>
                <span className="center-agent-glyph">{agentGlyphs[activeSession.agentId] ?? '◈'}</span>
                <span>{agents.find((a) => a.id === activeSession.agentId)?.label ?? activeSession.agentId}</span>
              </span>
            )}
          </div>
        </div>
        <div className="chat-header-actions">
          <ChatSessionList />
          {activeSession && (
            <button
              type="button"
              className={`pane-toggle-btn chat-debug-btn${showChatDebugPanel ? ' active' : ''}`}
              title={showChatDebugPanel ? 'Hide chat debug log' : 'Show chat debug log'}
              aria-label={showChatDebugPanel ? 'Hide chat debug log' : 'Show chat debug log'}
              onClick={() => setShowChatDebugPanel((value) => !value)}
            >
              <ChatDebugIcon />
            </button>
          )}
          {auxiliaryToggles}
        </div>
      </div>

      <div className="chat-main">
        {restoring ? (
          <div className="chat-empty">
            <div className="chat-connecting">
              <span className="chat-connecting-spinner" />
              Restoring session...
            </div>
          </div>
        ) : isConnecting && !activeSession ? (
          <div className="chat-empty">
            <div className="chat-connecting">
              <span className="chat-connecting-spinner" />
              Connecting to agent...
            </div>
          </div>
        ) : !activeSession ? (
          <div className="chat-messages chat-messages-new-chat">
            <NewChatHero onPromptSelect={handleSend} />
          </div>
        ) : (
          <div className="chat-messages">
            {showChatDebugPanel && (
              <div className="chat-debug-log" aria-live="polite">
                <div className="chat-debug-log-header">
                  <span>Chat Debug</span>
                  <span>{debugEntries.length > 0 ? `${debugEntries.length} entries` : 'Waiting for activity'}</span>
                </div>
                <div className="chat-debug-log-summary">
                  <span>Status: {activeSession.status}{activeSession.stalled ? ' (stalled)' : ''}</span>
                  <span>Connected: {connected ? 'yes' : 'no'}</span>
                  <span>Last event: {lastEventAgoSeconds === null ? 'n/a' : `${lastEventAgoSeconds}s ago`}</span>
                  <span>Last step: {liveStepLabel ?? 'n/a'}</span>
                </div>
                <div className="chat-debug-log-list">
                  {debugEntries.length === 0 ? (
                    <div className="chat-debug-log-empty">No chat debug activity yet.</div>
                  ) : debugEntries.slice().reverse().map((entry, index) => (
                    <div key={`${entry.timestamp}-${entry.source}-${index}`} className={`chat-debug-log-entry level-${entry.level}`}>
                      <span className="chat-debug-log-time">{formatDebugTimestamp(entry.timestamp)}</span>
                      <span className={`chat-debug-log-source source-${entry.source}`}>{entry.source}</span>
                      <span className="chat-debug-log-message">{entry.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeSession.messages.map((msg, idx) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                streaming={isStreaming && msg.role === 'assistant' && idx === activeSession.messages.length - 1}
              />
            ))}
            {activeSession.pendingPermission && (
              <PermissionDialog
                permission={activeSession.pendingPermission}
                onRespond={respondPermission}
                onReject={rejectPermission}
              />
            )}
            {isStreaming && !activeSession.pendingPermission && (
              <div className={`chat-streaming${activeSession.stalled ? ' stalled' : ''}`}>
                <span className="chat-typing-indicator"><span /><span /><span /></span>
                <span className="chat-streaming-label">
                  {activeSession.stalled
                    ? `No new update for a while.${liveStepLabel ? ` Last step: ${liveStepLabel}.` : ''}`
                    : (liveStepLabel ? `Working: ${liveStepLabel}` : 'Working...')}
                </span>
              </div>
            )}
            {/* ADR-0004 / VAL-RESUME-005: actionable recovery prompt when the
                agent subprocess crashed unrecoverably. The backend sent a done
                event with stopReason='agent_crash_unrecoverable' and CanResume.
                Show a reconnect button so the user can recover the session via
                the resume endpoint (which falls back to a fresh session). */}
            {activeSession.crashed && (
              <div className="chat-crash-recovery" role="alert">
                <div className="chat-crash-recovery-message">
                  ⚠️ AI Agent connection crashed and could not auto-recover.
                  {activeSession.canResume
                    ? ' You can try to reconnect and resume the session.'
                    : ' This agent does not support resuming — start a new session.'}
                </div>
                <button
                  className="chat-crash-recovery-btn"
                  type="button"
                  onClick={handleReconnect}
                  disabled={reconnecting}
                >
                  {reconnecting ? 'Reconnecting…' : (activeSession.canResume ? 'Reconnect' : 'New session')}
                </button>
              </div>
            )}
            {/* ADR-0004: surface resume/restart HTTP failures (network error,
                500, timeout) from resumeChatSession in the main panel, not just
                the session-list dropdown, so the user always sees the failure. */}
            {lastRestoreError && lastRestoreError.sessionId === (activeSession.recordId ?? activeSession.id) && (
              <div className="chat-crash-recovery chat-restore-error-inline" role="alert">
                <div className="chat-crash-recovery-message">
                  ⚠️ Reconnect failed: {lastRestoreError.reason}
                </div>
                <button
                  className="chat-crash-recovery-btn"
                  type="button"
                  onClick={handleReconnect}
                  disabled={reconnecting}
                >
                  {reconnecting ? 'Reconnecting…' : 'Retry'}
                </button>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      <div className="chat-bottom-bar">
        {!isArchived && activeSession && <ChatQueue sessionId={activeSession.id} onSendNow={handleSend} />}
        <ChatInput
          onSend={handleSend}
          onCancel={cancel}
          streaming={isStreaming}
          disabled={(isArchived && !canResumeArchived) || isConnecting}
          canSend={!activeSession ? true : connected}
          lockedBy={lockedBy}
          placeholder={!activeSession ? 'Describe a task or ask a question' : 'Type / for commands'}
          topContent={!activeSession ? <NewChatBar /> : undefined}
          footer={showConfigBar ? ({ openFilePicker, toggleVoice, voiceActive, voiceSupported }) => (
            <ConfigBar
              setConfigOption={setConfigOption}
              setAutoApprove={setAutoApprove}
              connected={connected}
              busy={isConnecting || restoring}
              busyLabel={configBusyLabel}
              onAttach={openFilePicker}
              onToggleVoice={toggleVoice}
              voiceActive={voiceActive}
              voiceSupported={voiceSupported}
            />
          ) : undefined}
        />
      </div>
    </div>
  );
}
