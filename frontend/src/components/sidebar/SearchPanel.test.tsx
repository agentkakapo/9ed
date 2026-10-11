import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchPanel } from './SearchPanel';
import * as api from '../../api';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock('../../api', () => ({
  searchFiles: vi.fn(),
}));

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('SearchPanel', () => {
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

  it('renders search input and triggers search on Enter', async () => {
    const mockSearch = vi.spyOn(api, 'searchFiles').mockResolvedValueOnce([
      { path: 'src/app.ts', line: 15, column: 2, preview: 'const app = 1;' },
    ]);
    const onResultClick = vi.fn();

    await act(async () => {
      root.render(<SearchPanel rootPath="/workspace/project" onResultClick={onResultClick} />);
    });

    const input = container.querySelector('input.search-input') as HTMLInputElement;
    expect(input).not.toBeNull();

    await act(async () => {
      setInputValue(input, 'app');
    });

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(mockSearch).toHaveBeenCalledWith('/workspace/project', 'app', false, 100, false);
    expect(container.textContent).toContain('1 result found');
    expect(container.textContent).toContain('src/app.ts:15');

    const resultRow = container.querySelector('.search-result-row') as HTMLButtonElement;
    expect(resultRow).not.toBeNull();
    act(() => {
      resultRow.click();
    });

    expect(onResultClick).toHaveBeenCalledWith('/workspace/project/src/app.ts', 'app.ts', 15, 2);
  });

  it('handles empty results safely without errors', async () => {
    vi.spyOn(api, 'searchFiles').mockResolvedValueOnce([]);
    const onResultClick = vi.fn();

    await act(async () => {
      root.render(<SearchPanel rootPath="/workspace/project" onResultClick={onResultClick} />);
    });

    const input = container.querySelector('input.search-input') as HTMLInputElement;

    await act(async () => {
      setInputValue(input, 'nonexistent');
    });

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(container.textContent).toContain('No results found');
  });

  it('supports case sensitive toggle', async () => {
    const mockSearch = vi.spyOn(api, 'searchFiles').mockResolvedValue([]);

    await act(async () => {
      root.render(<SearchPanel rootPath="/workspace/project" onResultClick={vi.fn()} />);
    });

    const input = container.querySelector('input.search-input') as HTMLInputElement;
    await act(async () => {
      setInputValue(input, 'App');
    });

    const caseBtn = container.querySelector('button[aria-label="Match case"]') as HTMLButtonElement;
    expect(caseBtn).not.toBeNull();

    await act(async () => {
      caseBtn.click();
    });

    expect(mockSearch).toHaveBeenCalledWith('/workspace/project', 'App', false, 100, true);
  });

  it('clears query and results on clear button click', async () => {
    vi.spyOn(api, 'searchFiles').mockResolvedValue([
      { path: 'file.txt', line: 1, column: 1, preview: 'hello' },
    ]);

    await act(async () => {
      root.render(<SearchPanel rootPath="/workspace/project" onResultClick={vi.fn()} />);
    });

    const input = container.querySelector('input.search-input') as HTMLInputElement;
    await act(async () => {
      setInputValue(input, 'hello');
    });

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(container.textContent).toContain('1 result found');

    const clearBtn = container.querySelector('.search-clear-btn') as HTMLButtonElement;
    expect(clearBtn).not.toBeNull();

    act(() => {
      clearBtn.click();
    });

    expect(input.value).toBe('');
    expect(container.textContent).not.toContain('1 result found');
  });
});
