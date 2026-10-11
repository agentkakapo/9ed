import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuickOpenModal } from './QuickOpenModal';
import * as api from '../../api';
import type { FileTab } from '../../types';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock('../../api', () => ({
  searchFiles: vi.fn(),
}));

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('QuickOpenModal', () => {
  let container: HTMLDivElement;
  let root: Root;

  const openFiles: FileTab[] = [
    { id: '/repo/src/main.ts', path: '/repo/src/main.ts', name: 'main.ts', content: '', language: 'ts', modified: false },
    { id: '/repo/src/app.ts', path: '/repo/src/app.ts', name: 'app.ts', content: '', language: 'ts', modified: false },
  ];

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

  it('renders open files when query is empty', async () => {
    await act(async () => {
      root.render(
        <QuickOpenModal
          rootPath="/repo"
          openFiles={openFiles}
          onSelectFile={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('main.ts');
    expect(container.textContent).toContain('app.ts');
  });

  it('calls onClose when Escape key is pressed', async () => {
    const onClose = vi.fn();
    await act(async () => {
      root.render(
        <QuickOpenModal
          rootPath="/repo"
          openFiles={openFiles}
          onSelectFile={vi.fn()}
          onClose={onClose}
        />,
      );
    });

    const modal = container.querySelector('.quickopen-modal') as HTMLDivElement;
    act(() => {
      modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onClose).toHaveBeenCalled();
  });

  it('selects file and calls onSelectFile on click', async () => {
    const onSelectFile = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <QuickOpenModal
          rootPath="/repo"
          openFiles={openFiles}
          onSelectFile={onSelectFile}
          onClose={onClose}
        />,
      );
    });

    const item = container.querySelector('.quickopen-item') as HTMLDivElement;
    expect(item).not.toBeNull();

    act(() => {
      item.click();
    });

    expect(onSelectFile).toHaveBeenCalledWith('/repo/src/main.ts', 'main.ts', undefined);
    expect(onClose).toHaveBeenCalled();
  });

  it('searches files when query is typed and selects with Enter', async () => {
    vi.spyOn(api, 'searchFiles').mockResolvedValue([
      { path: 'src/utils.ts', line: 10, column: 1, preview: 'export function util() {}' },
    ]);

    const onSelectFile = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <QuickOpenModal
          rootPath="/repo"
          openFiles={openFiles}
          onSelectFile={onSelectFile}
          onClose={onClose}
        />,
      );
    });

    const input = container.querySelector('input.quickopen-input') as HTMLInputElement;

    await act(async () => {
      setInputValue(input, 'util');
      // wait for debounce timer
      await new Promise((res) => setTimeout(res, 200));
    });

    expect(container.textContent).toContain('utils.ts');

    const modal = container.querySelector('.quickopen-modal') as HTMLDivElement;
    act(() => {
      modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(onSelectFile).toHaveBeenCalledWith('/repo/src/utils.ts', 'utils.ts', 10);
    expect(onClose).toHaveBeenCalled();
  });
});
