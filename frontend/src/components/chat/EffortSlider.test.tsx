import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EffortSlider } from './EffortSlider';
import type { ConfigOptionInfo } from '../../types';

class MockPointerEvent extends MouseEvent {
  pointerId: number;
  constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
  }
}

// Polyfill PointerEvent for jsdom
if (typeof globalThis.PointerEvent === 'undefined') {
  globalThis.PointerEvent = MockPointerEvent as unknown as typeof PointerEvent;
}

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe('EffortSlider', () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockOption: ConfigOptionInfo = {
    id: 'effort',
    name: 'Effort',
    type: 'select',
    currentValue: 'medium',
    options: [
      { value: 'low', name: 'Low' },
      { value: 'medium', name: 'Medium' },
      { value: 'high', name: 'High' },
      { value: 'max', name: 'Extra High' },
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
  });

  it('renders trigger button with current label', () => {
    act(() => {
      root.render(
        <EffortSlider
          option={mockOption}
          isOpen={false}
          onToggle={vi.fn()}
          onClose={vi.fn()}
          onChange={vi.fn()}
        />,
      );
    });

    const btn = container.querySelector('.effort-pill-btn');
    expect(btn?.textContent).toBe('Medium');
  });

  it('renders popover with track, thumb, and stops when open', () => {
    act(() => {
      root.render(
        <EffortSlider
          option={mockOption}
          isOpen={true}
          onToggle={vi.fn()}
          onClose={vi.fn()}
          onChange={vi.fn()}
        />,
      );
    });

    const popover = document.body.querySelector('.effort-popover-card');
    expect(popover).not.toBeNull();
    expect(popover?.querySelector('.effort-popover-value')?.textContent).toBe('Medium');

    const thumb = popover?.querySelector('.effort-slider-thumb');
    expect(thumb).not.toBeNull();

    const stops = popover?.querySelectorAll('.effort-slider-stop');
    expect(stops?.length).toBe(4);
  });

  it('does NOT call onChange while dragging, only calls onChange on release', () => {
    const onChange = vi.fn();

    act(() => {
      root.render(
        <EffortSlider
          option={mockOption}
          isOpen={true}
          onToggle={vi.fn()}
          onClose={vi.fn()}
          onChange={onChange}
        />,
      );
    });

    const track = document.body.querySelector('.effort-slider-track') as HTMLDivElement;
    expect(track).not.toBeNull();

    // Mock getBoundingClientRect on track
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 100,
      width: 200,
      height: 26,
      right: 300,
      bottom: 126,
      x: 100,
      y: 100,
      toJSON: () => {},
    });

    // Pointer down at Medium (center ~ 175px)
    act(() => {
      track.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 175,
          clientY: 110,
          bubbles: true,
          pointerId: 1,
        }),
      );
    });

    expect(onChange).not.toHaveBeenCalled();

    // Pointer move across to High (x ~ 230px, segment 2 of 4)
    act(() => {
      track.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: 230,
          clientY: 110,
          bubbles: true,
          pointerId: 1,
        }),
      );
    });

    // Label should preview High, but onChange must NOT be called yet!
    const valueEl = document.body.querySelector('.effort-popover-value');
    expect(valueEl?.textContent).toBe('High');
    expect(onChange).not.toHaveBeenCalled();

    // Pointer up on release!
    act(() => {
      track.dispatchEvent(
        new PointerEvent('pointerup', {
          clientX: 230,
          clientY: 110,
          bubbles: true,
          pointerId: 1,
        }),
      );
    });

    // Now onChange is called with 'high'!
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('high');
  });

  it('does not call onChange when released on the same value', () => {
    const onChange = vi.fn();

    act(() => {
      root.render(
        <EffortSlider
          option={mockOption}
          isOpen={true}
          onToggle={vi.fn()}
          onClose={vi.fn()}
          onChange={onChange}
        />,
      );
    });

    const track = document.body.querySelector('.effort-slider-track') as HTMLDivElement;
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 26,
      right: 200,
      bottom: 26,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    // Press and release at Medium (around 75px in 200px width -> segment 1 -> medium)
    act(() => {
      track.dispatchEvent(new PointerEvent('pointerdown', { clientX: 75, clientY: 10, bubbles: true, pointerId: 1 }));
      track.dispatchEvent(new PointerEvent('pointerup', { clientX: 75, clientY: 10, bubbles: true, pointerId: 1 }));
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('supports keyboard navigation with arrow keys', () => {
    const onChange = vi.fn();

    act(() => {
      root.render(
        <EffortSlider
          option={mockOption}
          isOpen={true}
          onToggle={vi.fn()}
          onClose={vi.fn()}
          onChange={onChange}
        />,
      );
    });

    const track = document.body.querySelector('.effort-slider-track') as HTMLDivElement;
    expect(track).not.toBeNull();

    // ArrowRight: Medium (idx 1) -> High (idx 2)
    act(() => {
      track.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith('high');

    // ArrowLeft: Medium (idx 1) -> Low (idx 0)
    act(() => {
      track.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith('low');
  });
});
