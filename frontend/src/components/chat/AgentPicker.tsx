import { createPortal } from 'react-dom';
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { sessionBelongsToWorkDir, useChatStore } from '../../stores/chat';
import { useWorkspaceStore } from '../../stores/workspace';
import type { ConfigOptionInfo } from '../../types';
import { ModelDropdown } from './ModelDropdown';
import { cleanOptionName, hasModelEfforts, normalizeConfigOption, splitModelAndEffort, type EffortLevel } from './modelEffort';

export function AgentPicker() {
  const agents = useChatStore((s) => s.agents);
  const selectedAgentId = useChatStore((s) => s.selectedAgentId);
  const setSelectedAgent = useChatStore((s) => s.setSelectedAgent);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [overlayStyle, setOverlayStyle] = useState<Record<string, string>>({});

  const currentAgent = agents.find((a) => a.id === selectedAgentId);

  const handleSelectAgent = (agentId: string) => {
    setSelectedAgent(agentId);
    setOpen(false);
  };

  const buttonLabel = currentAgent?.label ?? 'Select agent';

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const width = Math.min(260, Math.max(220, Math.floor(window.innerWidth * 0.28)));
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
      const top = Math.min(rect.bottom + 6, window.innerHeight - 24);
      const maxHeight = Math.max(160, Math.min(280, window.innerHeight - top - 12));
      setOverlayStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${width}px`,
        maxHeight: `${maxHeight}px`,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (triggerRef.current?.contains(target)) return;
      const overlay = document.querySelector('.picker-dropdown-overlay');
      if (overlay?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  const dropdown = useMemo(() => createPortal(
    <div className="picker-dropdown picker-dropdown-overlay" data-overlay="true" style={overlayStyle}>
      {agents.map((agent) => (
        <button
          key={agent.id}
          className="picker-dropdown-item"
          data-active={agent.id === selectedAgentId ? 'true' : 'false'}
          data-available={agent.available ? 'true' : 'false'}
          onClick={() => agent.available && handleSelectAgent(agent.id)}
          disabled={!agent.available}
          type="button"
        >
          {agent.label}
        </button>
      ))}
    </div>,
    document.body,
  ), [agents, selectedAgentId, overlayStyle]);

  return (
    <div className="chat-picker-wrap">
      <button
        ref={triggerRef}
        className="agent-picker"
        onClick={() => setOpen(!open)}
        type="button"
      >
        <span className="agent-picker-label">{buttonLabel}</span>
        <span className="agent-picker-caret" aria-hidden="true">▾</span>
      </button>
      {open ? dropdown : null}
    </div>
  );
}

type ConfigBarProps = {
  setConfigOption?: (configId: string, value: string) => void;
  setAutoApprove?: (enabled: boolean) => void;
  connected?: boolean;
  busy?: boolean;
  busyLabel?: string | null;
};

// `connected` remains in the public prop API (ChatPanel still passes it) but soft
// MCP toggles are no longer gated on WS connection / idle hard-restart safety.
export function ConfigBar({ setConfigOption, setAutoApprove, connected: _connected = false, busy = false, busyLabel = null }: ConfigBarProps) {
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const sessions = useChatStore((s) => s.sessions);
  const activeProject = useWorkspaceStore((s) => s.projects.find((p) => p.id === s.activeProjectId) ?? null);
  const includeIgnored = useChatStore((s) => s.includeIgnoredInMentions);
  const toggleIncludeIgnored = useChatStore((s) => s.toggleIncludeIgnored);
  const autoApprove = useChatStore((s) => s.autoApprove);
  const toggleAutoApprove = useChatStore((s) => s.toggleAutoApprove);
  const useActiveBrowser = useChatStore((s) => s.useActiveBrowser);
  const setBrowserEnabled = useChatStore((s) => s.setBrowserEnabled);
  const useActiveTerminal = useChatStore((s) => s.useActiveTerminal);
  const setTerminalEnabled = useChatStore((s) => s.setTerminalEnabled);
  const activeTerminalId = useChatStore((s) => s.activeTerminalId);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId && sessionBelongsToWorkDir(s, activeProject?.path));
  const configOptions = activeSession?.configOptions ?? [];
  const hasActiveSession = !!activeSession;
  const activeBrowserTabId = activeProject?.activeBrowserTabId ?? null;
  const browserCurrentEnabled = !!(activeSession?.useActiveBrowser ?? useActiveBrowser);
  const terminalCurrentEnabled = !!(activeSession?.useActiveTerminal ?? (useActiveTerminal && !!activeTerminalId));
  // Soft browser toggle: safe while idle or streaming (VAL-HARDEN-006).
  // Soft WS path does not require status==='idle' (legacy hard-restart gate).
  // Legitimate gates only: pending permission, and open tab required to enable.
  const browserSoftSafe = !activeSession || !activeSession.pendingPermission;
  const browserCanEnable = browserSoftSafe && !!activeBrowserTabId;
  const browserToggleEnabled = !activeSession
    ? true
    : (browserCurrentEnabled ? browserSoftSafe : browserCanEnable);
  const browserToggleTitle = browserCurrentEnabled
    ? (browserSoftSafe
      ? 'Enable or disable the active browser MCP bridge for this agent session'
      : 'Browser can be toggled when no permission is pending')
    : (!activeBrowserTabId
      ? 'No browser tab active in this project'
      : (browserCanEnable
        ? 'Enable or disable the active browser MCP bridge for this agent session'
        : 'Browser can be toggled when no permission is pending'));
  // Soft terminal toggle: safe while idle or streaming (VAL-HARDEN-001/007).
  // Only requires a bound active terminal id; never restarts the session.
  const terminalToggleEnabled = !!activeTerminalId && (!activeSession || !activeSession.pendingPermission);
  const terminalToggleTitle = !activeTerminalId
    ? 'No terminal active'
    : 'Enable or disable the active terminal MCP bridge for this agent session';
  const handleChange = (configId: string, value: string) => {
    setOpenDropdown(null);
    setConfigOption?.(configId, value);
  };

  const handleAutoApproveToggle = () => {
    const newValue = !autoApprove;
    toggleAutoApprove();
    setAutoApprove?.(newValue);
  };

  const handleBrowserToggle = () => {
    // Soft toggle: setBrowserEnabled updates the store + session flag and the
    // WS effect in useChatSession.ts sends `set_use_active_browser` over the
    // existing connection — no session restart. Same path used by
    // BrowserPanel/useInspectMode, preventing state desync when toggling from
    // different UI locations.
    if (activeSession && !browserToggleEnabled) return;
    const enabled = !(activeSession?.useActiveBrowser ?? useActiveBrowser);
    void setBrowserEnabled(enabled);
  };

  const handleTerminalToggle = () => {
    // Soft toggle only (VAL-HARDEN-001): setTerminalEnabled updates store +
    // session and the WS effect sends `set_use_active_terminal` over the
    // existing connection — never HTTP resume / restartActiveSessionForTerminal.
    if (!terminalToggleEnabled) return;
    const enabled = !(activeSession?.useActiveTerminal ?? (useActiveTerminal && !!activeTerminalId));
    void setTerminalEnabled(enabled);
  };

  const normalizedOptions = useMemo(() => configOptions.map(normalizeConfigOption), [configOptions]);
  const modelOpt = normalizedOptions.find((opt) => isModelOption(opt));
  const effortSplitting = useMemo(() => {
    if (!modelOpt || !hasModelEfforts(modelOpt)) return null;
    return splitModelAndEffort(modelOpt);
  }, [modelOpt]);

  return (
    <div className="chat-config-bar">
      {busyLabel && (
        <div className="chat-config-status" aria-live="polite">
          <span className="chat-connecting-spinner chat-inline-spinner" />
          <span className="chat-config-status-label">{busyLabel}</span>
        </div>
      )}
      {normalizedOptions.map((opt) => {
        if (isModelOption(opt)) {
          if (effortSplitting) {
            return (
              <Fragment key={opt.id}>
                <ModelDropdown
                  key={opt.id}
                  option={effortSplitting.baseModelOption}
                  isOpen={!hasActiveSession ? false : openDropdown === opt.id}
                  onToggle={() => hasActiveSession && setOpenDropdown(openDropdown === opt.id ? null : opt.id)}
                  onClose={() => setOpenDropdown(null)}
                  onChange={(baseName) => {
                    const fullVal = effortSplitting.resolveModelValue(baseName, effortSplitting.currentEffort);
                    handleChange(opt.id, fullVal);
                  }}
                  disabled={!hasActiveSession || busy}
                />
                <ConfigDropdown
                  key={`${opt.id}_effort`}
                  option={effortSplitting.effortOption}
                  variant="compact"
                  isOpen={!hasActiveSession ? false : openDropdown === `${opt.id}_effort`}
                  onToggle={() => hasActiveSession && setOpenDropdown(openDropdown === `${opt.id}_effort` ? null : `${opt.id}_effort`)}
                  onClose={() => setOpenDropdown(null)}
                  onChange={(newEffort) => {
                    const fullVal = effortSplitting.resolveModelValue(effortSplitting.currentBaseModel, newEffort as EffortLevel);
                    handleChange(opt.id, fullVal);
                  }}
                  disabled={!hasActiveSession || busy}
                />
              </Fragment>
            );
          }
          return (
            <ModelDropdown
              key={opt.id}
              option={opt}
              isOpen={!hasActiveSession ? false : openDropdown === opt.id}
              onToggle={() => hasActiveSession && setOpenDropdown(openDropdown === opt.id ? null : opt.id)}
              onClose={() => setOpenDropdown(null)}
              onChange={(value) => handleChange(opt.id, value)}
              disabled={!hasActiveSession || busy}
            />
          );
        }
        return (
          <ConfigDropdown
            key={opt.id}
            option={opt}
            variant={getConfigDropdownVariant(opt)}
            isOpen={!hasActiveSession ? false : openDropdown === opt.id}
            onToggle={() => hasActiveSession && setOpenDropdown(openDropdown === opt.id ? null : opt.id)}
            onClose={() => setOpenDropdown(null)}
            onChange={(value) => handleChange(opt.id, value)}
            disabled={!hasActiveSession || busy}
          />
        );
      })}
      <label
        className={`chat-config-toggle${autoApprove ? ' active' : ''}`}
        title="Auto-approve all tool permissions (yolo mode)"
      >
        <input
          type="checkbox"
          checked={autoApprove}
          onChange={handleAutoApproveToggle}
          disabled={busy}
        />
        <span className="chat-config-dot" aria-hidden="true" />
        <span className="chat-config-toggle-label">Auto</span>
      </label>
      <label
        className={`chat-config-toggle${includeIgnored ? ' active' : ''}`}
        title="Include gitignored files in @ mentions"
      >
        <input
          type="checkbox"
          checked={includeIgnored}
          onChange={toggleIncludeIgnored}
          disabled={busy}
        />
        <span className="chat-config-dot" aria-hidden="true" />
        <span className="chat-config-toggle-label">@ ignored</span>
      </label>
      <label
        className={`chat-config-toggle chat-config-toggle-mcp${browserCurrentEnabled ? ' active' : ''}${activeSession && !browserToggleEnabled ? ' disabled' : ''}`}
        title={browserToggleTitle}
      >
        <input
          type="checkbox"
          checked={browserCurrentEnabled}
          onChange={handleBrowserToggle}
          disabled={busy || (!!activeSession && !browserToggleEnabled)}
        />
        <span className="chat-config-dot" aria-hidden="true" />
        <span className="chat-config-toggle-label">Browser</span>
      </label>
      <label
        className={`chat-config-toggle chat-config-toggle-mcp${terminalCurrentEnabled ? ' active' : ''}${!terminalToggleEnabled ? ' disabled' : ''}`}
        title={terminalToggleTitle}
      >
        <input
          type="checkbox"
          checked={terminalCurrentEnabled}
          onChange={handleTerminalToggle}
          disabled={busy || !terminalToggleEnabled}
        />
        <span className="chat-config-dot" aria-hidden="true" />
        <span className="chat-config-toggle-label">Terminal</span>
      </label>
    </div>
  );
}

function isModelOption(option: ConfigOptionInfo): boolean {
  return option.id.toLowerCase().includes('model');
}

type ConfigDropdownVariant = 'compact' | 'rich';

function getConfigDropdownVariant(option: ConfigOptionInfo): ConfigDropdownVariant {
  if (option.id === 'model') return 'rich';
  return 'compact';
}

function ConfigDropdown({ option: rawOption, variant, isOpen, onToggle, onClose, onChange, disabled }: {
  option: ConfigOptionInfo;
  variant: ConfigDropdownVariant;
  isOpen: boolean;
  onToggle: () => void;
  onClose?: () => void;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const option = useMemo(() => normalizeConfigOption(rawOption), [rawOption]);
  const currentOption = option.options.find((o) => o.value === option.currentValue);
  const rawLabel = currentOption?.name ?? option.currentValue;
  const label = cleanOptionName(rawLabel, option.id, currentOption?.description);
  const displayLabel = label;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [overlayStyle, setOverlayStyle] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      onClose?.();
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen, onClose]);

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const minWidth = variant === 'rich' ? 220 : 180;
      const maxWidth = variant === 'rich' ? 320 : 260;
      const preferredWidth = variant === 'rich'
        ? Math.floor(window.innerWidth * 0.28)
        : Math.floor(window.innerWidth * 0.2);
      const width = Math.min(maxWidth, Math.max(minWidth, preferredWidth));
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
      const topViewportPadding = 12;
      const bottomViewportPadding = 12;
      const gap = 6;
      const aboveSpace = Math.max(0, rect.top - topViewportPadding - gap);
      const belowSpace = Math.max(0, window.innerHeight - rect.bottom - bottomViewportPadding - gap);
      const heightCap = variant === 'rich' ? 320 : 240;
      const minPreferredHeight = variant === 'rich' ? 140 : 100;
      const shouldOpenDownward = aboveSpace < minPreferredHeight && belowSpace > aboveSpace;

      if (shouldOpenDownward) {
        const top = rect.bottom + gap;
        const belowMaxHeight = Math.max(80, Math.min(heightCap, belowSpace));
        setOverlayStyle({
          position: 'fixed',
          left: `${left}px`,
          top: `${top}px`,
          width: `${width}px`,
          maxHeight: `${belowMaxHeight}px`,
        });
        return;
      }

      const upwardMaxHeight = Math.max(80, Math.min(heightCap, aboveSpace));
      const bottom = window.innerHeight - rect.top + gap;

      setOverlayStyle({
        position: 'fixed',
        left: `${left}px`,
        top: 'auto',
        bottom: `${bottom}px`,
        width: `${width}px`,
        maxHeight: `${upwardMaxHeight}px`,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, variant]);

  const dropdown = createPortal(
    <div
      ref={dropdownRef}
      className={`picker-dropdown picker-dropdown-overlay picker-dropdown-${variant}`}
      data-overlay="true"
      style={overlayStyle}
    >
      {option.options.map((val) => {
        const itemName = cleanOptionName(val.name, option.id, val.description);
        const isSelected = val.value === option.currentValue || itemName === label;
        return (
          <button
            key={val.value}
            className="picker-dropdown-item"
            data-active={isSelected ? 'true' : 'false'}
            onClick={() => onChange(val.value)}
            type="button"
          >
            {itemName}
          </button>
        );
      })}
    </div>,
    document.body,
  );

  return (
    <div className={`chat-picker-wrap ${variant === 'rich' ? 'chat-picker-wrap-rich' : 'chat-picker-wrap-compact'}`}>
      <button
        ref={triggerRef}
        className={`agent-picker ${variant === 'rich' ? 'agent-picker-rich' : 'agent-picker-compact'}`}
        onClick={onToggle}
        type="button"
        data-compact={variant === 'compact' ? 'true' : undefined}
        title={option.name}
        disabled={disabled}
      >
        <span className={`agent-picker-label ${variant === 'rich' ? 'agent-picker-label-multiline' : 'agent-picker-label-compact'}`}>{displayLabel}</span>
        <span className="agent-picker-caret" aria-hidden="true">▾</span>
      </button>
      {isOpen ? dropdown : null}
    </div>
  );
}
