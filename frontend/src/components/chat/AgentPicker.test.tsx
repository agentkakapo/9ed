import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentPicker, ConfigBar } from './AgentPicker';
import { useChatStore } from '../../stores/chat';
import { useWorkspaceStore } from '../../stores/workspace';
import type { ChatSessionInfo } from '../../types';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function resetChatStore() {
  useChatStore.setState({
    sessions: [],
    activeSessionId: null,
    agents: [
      { id: 'opencode', label: 'OpenCode', available: true, configFound: true, activeModel: '', models: [], providers: [] },
      { id: 'claude', label: 'Claude Code', available: true, configFound: true, activeModel: '', models: [], providers: [] },
    ],
    selectedAgentId: null,
    chatVisible: false,
    historySessions: [],
    historyLoaded: false,
    historyWorkDir: null,
    queuedMessages: {},
    includeIgnoredInMentions: false,
    autoApprove: false,
    restoring: false,
    lastRestoreError: null,
  });
}

describe('AgentPicker', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    resetChatStore();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders select-agent dropdown in overlay root when opened', () => {
    act(() => {
      root.render(<AgentPicker />);
    });

    const trigger = container.querySelector('.agent-picker');
    expect(trigger).not.toBeNull();

    act(() => {
      trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const overlay = document.body.querySelector('.picker-dropdown.picker-dropdown-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay?.textContent).toContain('OpenCode');
    expect(overlay?.textContent).toContain('Claude Code');
    expect(overlay?.getAttribute('data-overlay')).toBe('true');
  });

  it('sets selectedAgentId in store when agent is picked', async () => {
    act(() => {
      root.render(<AgentPicker />);
    });

    const trigger = container.querySelector('.agent-picker');
    expect(trigger).not.toBeNull();

    act(() => {
      trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const option = document.body.querySelector('.picker-dropdown-overlay .picker-dropdown-item');
    expect(option?.textContent).toContain('OpenCode');

    await act(async () => {
      option?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(useChatStore.getState().selectedAgentId).toBe('opencode');
  });
});

function makeSession(overrides: Partial<ChatSessionInfo> = {}): ChatSessionInfo {
  return {
    id: 'live-1',
    recordId: 'record-1',
    agentId: 'opencode',
    title: 'Browser toggle',
    messages: [],
    status: 'idle',
    createdAt: 1,
    kind: 'live',
    workDir: '/repo',
    acpSessionId: 'acp-1',
    ...overrides,
  };
}

function resetConfigStores({ withTab }: { withTab: boolean }) {
  useChatStore.setState({
    sessions: [],
    activeSessionId: null,
    agents: [{ id: 'opencode', label: 'OpenCode', available: true, configFound: true, activeModel: '', models: [], providers: [] }],
    selectedAgentId: 'opencode',
    chatVisible: false,
    historySessions: [],
    historyLoaded: false,
    historyWorkDir: null,
    queuedMessages: {},
    includeIgnoredInMentions: false,
    autoApprove: false,
    useActiveBrowser: false,
    browserSelection: null,
    useActiveTerminal: false,
    activeTerminalId: null,
    restoring: false,
    lastRestoreError: null,
  });
  useWorkspaceStore.setState({
    projects: [{
      id: 'project-1',
      path: '/repo',
      name: 'repo',
      openFiles: [],
      activeFileId: null,
      terminalTabs: [],
      activeTerminalTabId: null,
      terminalSessions: [],
      browserTabIds: withTab ? ['tab-1'] : [],
      activeBrowserTabId: withTab ? 'tab-1' : null,
    }],
    activeProjectId: 'project-1',
    activePanel: 'explorer',
    sidebarVisible: true,
    terminalVisible: true,
    chatVisible: true,
    browserVisible: false,
    showPicker: false,
  });
}

describe('ConfigBar browser toggle', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('checkbox reflects session.useActiveBrowser (not just global flag)', () => {
    resetConfigStores({ withTab: true });
    useChatStore.setState({
      sessions: [makeSession({ id: 'live-1', useActiveBrowser: true })],
      activeSessionId: 'live-1',
      // Global flag disagrees with the session flag: the checkbox must
      // follow the session (the primary source) per VAL-SOFTTOGGLE-001.
      useActiveBrowser: false,
    });

    act(() => {
      root.render(<ConfigBar connected />);
    });

    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"][title*="browser" i], .chat-config-toggle-mcp input[type="checkbox"]');
    expect(checkbox).not.toBeNull();
    expect(checkbox?.checked).toBe(true);
  });

  it('clicking the checkbox updates useActiveBrowser instantly with no connecting status', async () => {
    resetConfigStores({ withTab: true });
    useChatStore.setState({
      sessions: [makeSession({ id: 'live-1', useActiveBrowser: false })],
      activeSessionId: 'live-1',
      useActiveBrowser: false,
    });

    act(() => {
      root.render(<ConfigBar connected />);
    });

    const label = container.querySelector<HTMLLabelElement>('.chat-config-toggle-mcp');
    const checkbox = label?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox?.checked).toBe(false);

    await act(async () => {
      checkbox?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Instant: store + session flag flipped synchronously.
    expect(useChatStore.getState().useActiveBrowser).toBe(true);
    const session = useChatStore.getState().sessions.find((s) => s.id === 'live-1');
    expect(session?.useActiveBrowser).toBe(true);
    // VAL-SOFTTOGGLE-001: no connecting status introduced by the toggle.
    expect(session?.status).toBe('idle');
  });

  function getBrowserToggle(): { label: HTMLLabelElement; checkbox: HTMLInputElement } {
    const labels = Array.from(container.querySelectorAll<HTMLLabelElement>('.chat-config-toggle-mcp'));
    const label = labels.find((el) => el.textContent?.includes('Browser'));
    expect(label).toBeTruthy();
    const checkbox = label!.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox).not.toBeNull();
    return { label: label!, checkbox: checkbox! };
  }

  it('allows soft browser toggle while streaming (VAL-HARDEN-006 soft-safe)', async () => {
    resetConfigStores({ withTab: true });
    useChatStore.setState({
      sessions: [makeSession({ id: 'live-1', status: 'streaming', useActiveBrowser: false })],
      activeSessionId: 'live-1',
      useActiveBrowser: false,
    });

    act(() => {
      root.render(<ConfigBar connected />);
    });

    const { checkbox, label } = getBrowserToggle();
    // Soft path must not hard-restart-gate on streaming status.
    expect(checkbox.disabled).toBe(false);
    expect(label.title.toLowerCase()).not.toMatch(/restart|reconnect|ready/);

    await act(async () => {
      checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const session = useChatStore.getState().sessions.find((s) => s.id === 'live-1');
    expect(session?.useActiveBrowser).toBe(true);
    expect(session?.status).toBe('streaming');
    expect(session?.kind).toBe('live');
  });

  it('allows soft browser disable while streaming when already enabled (VAL-HARDEN-006)', async () => {
    resetConfigStores({ withTab: true });
    useChatStore.setState({
      sessions: [makeSession({ id: 'live-1', status: 'streaming', useActiveBrowser: true })],
      activeSessionId: 'live-1',
      useActiveBrowser: true,
    });

    act(() => {
      root.render(<ConfigBar connected />);
    });

    const { checkbox } = getBrowserToggle();
    expect(checkbox.disabled).toBe(false);
    expect(checkbox.checked).toBe(true);

    await act(async () => {
      checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const session = useChatStore.getState().sessions.find((s) => s.id === 'live-1');
    expect(session?.useActiveBrowser).toBe(false);
    expect(session?.status).toBe('streaming');
  });

  it('still disables browser enable when no browser tab is open (legitimate gate)', () => {
    resetConfigStores({ withTab: false });
    useChatStore.setState({
      sessions: [makeSession({ id: 'live-1', status: 'streaming', useActiveBrowser: false })],
      activeSessionId: 'live-1',
      useActiveBrowser: false,
    });

    act(() => {
      root.render(<ConfigBar connected />);
    });

    const { checkbox, label } = getBrowserToggle();
    expect(checkbox.disabled).toBe(true);
    expect(label.title.toLowerCase()).toMatch(/no browser tab/i);
  });
});

describe('ConfigBar terminal soft toggle (VAL-HARDEN-001/007)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function getTerminalToggle(): { label: HTMLLabelElement; checkbox: HTMLInputElement } {
    const labels = Array.from(container.querySelectorAll<HTMLLabelElement>('.chat-config-toggle-mcp'));
    const label = labels.find((el) => el.textContent?.includes('Terminal'));
    expect(label).toBeTruthy();
    const checkbox = label!.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox).not.toBeNull();
    return { label: label!, checkbox: checkbox! };
  }

  it('checkbox reflects session.useActiveTerminal (not just global flag)', () => {
    resetConfigStores({ withTab: true });
    useChatStore.setState({
      sessions: [makeSession({ id: 'live-1', useActiveTerminal: true, terminalId: 'term-1' })],
      activeSessionId: 'live-1',
      useActiveTerminal: false,
      activeTerminalId: 'term-1',
    });

    act(() => {
      root.render(<ConfigBar connected />);
    });

    const { checkbox } = getTerminalToggle();
    expect(checkbox.checked).toBe(true);
  });

  it('clicking terminal toggle uses setTerminalEnabled soft path — no connecting status', async () => {
    resetConfigStores({ withTab: true });
    useChatStore.setState({
      sessions: [makeSession({ id: 'live-1', useActiveTerminal: false })],
      activeSessionId: 'live-1',
      useActiveTerminal: false,
      activeTerminalId: 'term-1',
    });
    const setTerminalEnabledSpy = vi.spyOn(useChatStore.getState(), 'setTerminalEnabled');

    act(() => {
      root.render(<ConfigBar connected />);
    });

    const { checkbox, label } = getTerminalToggle();
    expect(checkbox.checked).toBe(false);
    // Soft toggle labels must not mention restarting / reconnecting.
    expect(label.title.toLowerCase()).not.toMatch(/restart|reconnect|connecting/);

    await act(async () => {
      checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(setTerminalEnabledSpy).toHaveBeenCalledWith(true);
    expect(useChatStore.getState().useActiveTerminal).toBe(true);
    const session = useChatStore.getState().sessions.find((s) => s.id === 'live-1');
    expect(session?.useActiveTerminal).toBe(true);
    expect(session?.status).toBe('idle');
    expect(session?.kind).toBe('live');
  });

  it('allows soft terminal toggle while streaming (VAL-HARDEN-007 soft-safe)', async () => {
    resetConfigStores({ withTab: true });
    useChatStore.setState({
      sessions: [makeSession({ id: 'live-1', status: 'streaming', useActiveTerminal: false })],
      activeSessionId: 'live-1',
      useActiveTerminal: false,
      activeTerminalId: 'term-1',
    });

    act(() => {
      root.render(<ConfigBar connected />);
    });

    const { checkbox, label } = getTerminalToggle();
    expect(checkbox.disabled).toBe(false);
    expect(label.title.toLowerCase()).not.toMatch(/restart|reconnect/);

    await act(async () => {
      checkbox.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const session = useChatStore.getState().sessions.find((s) => s.id === 'live-1');
    expect(session?.useActiveTerminal).toBe(true);
    expect(session?.status).toBe('streaming');
  });
});

describe('ConfigBar model dropdown', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.querySelectorAll('.model-menu-dropdown, .model-submenu-dropdown').forEach((el) => el.remove());
  });

  it('renders model option using ModelDropdown with full interaction support', () => {
    resetConfigStores({ withTab: true });
    const setConfigOptionSpy = vi.fn();
    useChatStore.setState({
      sessions: [makeSession({
        id: 'live-1',
        configOptions: [
          {
            id: 'model',
            name: 'Model',
            type: 'select',
            currentValue: 'claude-sonnet-5-5',
            options: [
              { value: 'claude-opus-5-5', name: 'Opus 5.5' },
              { value: 'claude-sonnet-5-5', name: 'Sonnet 5.5' },
              { value: 'claude-fable-5-1', name: 'Fable 5.1' },
              { value: 'claude-haiku-5-5', name: 'Haiku 5.5' },
              { value: 'claude-haiku-4-5', name: 'Haiku 4.5' },
            ],
          },
        ],
      })],
      activeSessionId: 'live-1',
    });

    act(() => {
      root.render(<ConfigBar connected setConfigOption={setConfigOptionSpy} />);
    });

    const trigger = container.querySelector('.model-picker-trigger');
    expect(trigger).not.toBeNull();
    expect(trigger?.textContent).toContain('Sonnet 5.5');

    // Click trigger to open
    act(() => {
      trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const menu = document.body.querySelector('.model-menu-dropdown');
    expect(menu).not.toBeNull();
    expect(menu?.textContent).toContain('Opus 5.5');
    expect(menu?.textContent).toContain('More models');

    // Select Opus 5.5
    const opusBtn = Array.from(menu?.querySelectorAll('.model-menu-item') ?? []).find((el) => el.textContent?.includes('Opus 5.5'));
    expect(opusBtn).toBeTruthy();

    act(() => {
      opusBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(setConfigOptionSpy).toHaveBeenCalledWith('model', 'claude-opus-5-5');
  });
});

