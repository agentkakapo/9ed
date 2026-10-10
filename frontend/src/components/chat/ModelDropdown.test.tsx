import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ModelDropdown, getModelBadge } from './ModelDropdown';
import type { ConfigOptionInfo } from '../../types';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe('getModelBadge', () => {
  it('does not show usage credits badge for fable or credit descriptions', () => {
    expect(getModelBadge({ value: 'claude-3-5-sonnet', name: 'Sonnet 3.5' })).toBeNull();
    expect(getModelBadge({ value: 'claude-fable-5-1', name: 'Fable 5.1' })).toBeNull();
    expect(getModelBadge({ value: 'custom-model', name: 'Custom', description: 'Requires usage credits to run' })).toBeNull();
  });

  it('detects reasoning badge', () => {
    expect(getModelBadge({ value: 'o3-mini', name: 'o3-mini', description: 'High reasoning effort' })).toEqual({
      text: 'Reasoning',
    });
  });
});

describe('ModelDropdown', () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockOption: ConfigOptionInfo = {
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
      { value: 'claude-sonnet-5-0', name: 'Sonnet 5' },
      { value: 'claude-opus-5-0', name: 'Opus 5' },
      { value: 'claude-fable-5-0', name: 'Fable 5' },
      { value: 'claude-opus-4-8', name: 'Opus 4.8' },
    ],
  };

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
    // Clean up any left-over portals in body
    document.querySelectorAll('.model-menu-dropdown, .model-submenu-dropdown').forEach((el) => el.remove());
  });

  it('renders trigger button with current model name', () => {
    act(() => {
      root.render(
        <ModelDropdown
          option={mockOption}
          isOpen={false}
          onToggle={vi.fn()}
          onClose={vi.fn()}
          onChange={vi.fn()}
        />
      );
    });

    const trigger = container.querySelector('.model-picker-trigger');
    expect(trigger).not.toBeNull();
    expect(trigger?.textContent).toContain('Sonnet 5.5');
  });

  it('renders top 4 models, checkmark for selected, shortcuts for non-selected, and "More models" trigger when open', () => {
    act(() => {
      root.render(
        <ModelDropdown
          option={mockOption}
          isOpen={true}
          onToggle={vi.fn()}
          onClose={vi.fn()}
          onChange={vi.fn()}
        />
      );
    });

    const menu = document.body.querySelector('.model-menu-dropdown');
    expect(menu).not.toBeNull();

    // Verify top 4 models
    expect(menu?.textContent).toContain('Opus 5.5');
    expect(menu?.textContent).toContain('Sonnet 5.5');
    expect(menu?.textContent).toContain('Fable 5.1');
    expect(menu?.textContent).toContain('Haiku 5.5');

    // Fable badge - usage credit label removed
    expect(menu?.textContent).not.toContain('Requires usage credits');

    // Shortcuts: 1 for Opus 5.5, 3 for Fable 5.1, 4 for Haiku 5.5
    expect(menu?.textContent).toContain('1');
    expect(menu?.textContent).toContain('3');
    expect(menu?.textContent).toContain('4');

    // Checkmark on selected (Sonnet 5.5)
    const checkIcon = menu?.querySelector('.model-item-check');
    expect(checkIcon).not.toBeNull();

    // More models trigger
    const moreBtn = menu?.querySelector('.model-more-trigger');
    expect(moreBtn).not.toBeNull();
    expect(moreBtn?.textContent).toContain('More models');
  });

  it('opens flyout submenu on "More models" hover and displays older models', () => {
    act(() => {
      root.render(
        <ModelDropdown
          option={mockOption}
          isOpen={true}
          onToggle={vi.fn()}
          onClose={vi.fn()}
          onChange={vi.fn()}
        />
      );
    });

    const moreBtn = document.body.querySelector('.model-more-trigger');
    expect(moreBtn).not.toBeNull();

    act(() => {
      moreBtn?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });

    const submenu = document.body.querySelector('.model-submenu-dropdown');
    expect(submenu).not.toBeNull();
    expect(submenu?.textContent).toContain('Haiku 4.5');
    expect(submenu?.textContent).toContain('Sonnet 5');
    expect(submenu?.textContent).toContain('Opus 5');
    expect(submenu?.textContent).toContain('Fable 5');
    expect(submenu?.textContent).toContain('Opus 4.8');
  });

  it('shows checkmark in submenu if the active model is an older model', () => {
    const olderActiveOption: ConfigOptionInfo = {
      ...mockOption,
      currentValue: 'claude-opus-5-0', // Opus 5 is in older models
    };

    act(() => {
      root.render(
        <ModelDropdown
          option={olderActiveOption}
          isOpen={true}
          onToggle={vi.fn()}
          onClose={vi.fn()}
          onChange={vi.fn()}
        />
      );
    });

    const moreBtn = document.body.querySelector('.model-more-trigger');
    act(() => {
      moreBtn?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });

    const submenu = document.body.querySelector('.model-submenu-dropdown');
    expect(submenu).not.toBeNull();
    const checkmark = submenu?.querySelector('.model-item-check');
    expect(checkmark).not.toBeNull();
  });

  it('selects model and closes when clicking an older model in the submenu', () => {
    const handleChange = vi.fn();
    const handleClose = vi.fn();

    act(() => {
      root.render(
        <ModelDropdown
          option={mockOption}
          isOpen={true}
          onToggle={vi.fn()}
          onClose={handleClose}
          onChange={handleChange}
        />
      );
    });

    const moreBtn = document.body.querySelector('.model-more-trigger');
    act(() => {
      moreBtn?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });

    const submenu = document.body.querySelector('.model-submenu-dropdown');
    const items = submenu?.querySelectorAll('.model-menu-item');
    const opusItem = Array.from(items ?? []).find((el) => el.textContent?.includes('Opus 5'));
    expect(opusItem).toBeTruthy();

    act(() => {
      opusItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(handleChange).toHaveBeenCalledWith('claude-opus-5-0');
    expect(handleClose).toHaveBeenCalled();
  });

  it('supports keyboard shortcuts 1-4 to select primary models', () => {
    const handleChange = vi.fn();
    const handleClose = vi.fn();

    act(() => {
      root.render(
        <ModelDropdown
          option={mockOption}
          isOpen={true}
          onToggle={vi.fn()}
          onClose={handleClose}
          onChange={handleChange}
        />
      );
    });

    // Press '1'
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
    });

    expect(handleChange).toHaveBeenCalledWith('claude-opus-5-5');
    expect(handleClose).toHaveBeenCalled();
  });

  it('closes when pressing Escape key', () => {
    const handleClose = vi.fn();

    act(() => {
      root.render(
        <ModelDropdown
          option={mockOption}
          isOpen={true}
          onToggle={vi.fn()}
          onClose={handleClose}
          onChange={vi.fn()}
        />
      );
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(handleClose).toHaveBeenCalled();
  });

  it('closes when clicking outside the dropdown', () => {
    const handleClose = vi.fn();

    act(() => {
      root.render(
        <ModelDropdown
          option={mockOption}
          isOpen={true}
          onToggle={vi.fn()}
          onClose={handleClose}
          onChange={vi.fn()}
        />
      );
    });

    act(() => {
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(handleClose).toHaveBeenCalled();
  });

  it('renders all models in primary list without "More models" when options count is <= 4', () => {
    const smallOption: ConfigOptionInfo = {
      ...mockOption,
      options: mockOption.options.slice(0, 3),
    };

    act(() => {
      root.render(
        <ModelDropdown
          option={smallOption}
          isOpen={true}
          onToggle={vi.fn()}
          onClose={vi.fn()}
          onChange={vi.fn()}
        />
      );
    });

    const menu = document.body.querySelector('.model-menu-dropdown');
    expect(menu?.textContent).toContain('Opus 5.5');
    expect(menu?.textContent).toContain('Sonnet 5.5');
    expect(menu?.textContent).toContain('Fable 5.1');
    expect(menu?.querySelector('.model-more-trigger')).toBeNull();
    expect(menu?.querySelector('.model-menu-divider')).toBeNull();
  });
});
