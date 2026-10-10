import { createPortal } from 'react-dom';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ConfigOptionInfo } from '../../types';
import { cleanOptionName, normalizeConfigOption } from './modelEffort';

export type EffortSliderProps = {
  option: ConfigOptionInfo;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function EffortSlider({
  option: rawOption,
  isOpen,
  onToggle,
  onClose,
  onChange,
  disabled,
}: EffortSliderProps) {
  const option = useMemo(() => normalizeConfigOption(rawOption), [rawOption]);
  const numOptions = option.options.length;

  const currentIndex = useMemo(() => {
    const idx = option.options.findIndex((o) => o.value === option.currentValue);
    return idx >= 0 ? idx : 0;
  }, [option.options, option.currentValue]);

  const [isDragging, setIsDragging] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragProgress, setDragProgress] = useState<number | null>(null);

  const pointerOriginRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

  // Display index: preview index while dragging, or confirmed currentIndex
  const displayIndex = isDragging && dragIndex !== null ? dragIndex : currentIndex;
  const currentOption = option.options[displayIndex] ?? option.options[0];
  const rawLabel = currentOption?.name ?? option.currentValue ?? 'Medium';
  const label = cleanOptionName(rawLabel, option.id, currentOption?.description);

  const recommendedIndex = useMemo(() => {
    const idx = option.options.findIndex((o) => o.name.toLowerCase() === 'medium');
    return idx >= 0 ? idx : Math.min(1, Math.max(0, numOptions - 1));
  }, [option.options, numOptions]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Position popover right above the pill trigger
  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverWidth = 270;
      let left = rect.right - popoverWidth;
      if (left < 12) left = 12;
      if (left + popoverWidth > window.innerWidth - 12) {
        left = window.innerWidth - popoverWidth - 12;
      }

      const gap = 8;
      const popoverHeight = 116;
      const top = Math.max(12, rect.top - popoverHeight - gap);

      setPopoverStyle({
        position: 'fixed',
        left: `${Math.round(left)}px`,
        top: `${Math.round(top)}px`,
        width: `${popoverWidth}px`,
        zIndex: 9999,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  const getProgressAndIndex = useCallback(
    (clientX: number, targetNode?: EventTarget | null) => {
      if (numOptions <= 0) return { progress: 0.5, index: 0 };
      const track = trackRef.current;

      const minProgress = 0.5 / numOptions;
      const maxProgress = (numOptions - 0.5) / numOptions;

      if (track) {
        const rect = track.getBoundingClientRect();
        if (rect.width > 0) {
          const rawFraction = (clientX - rect.left) / rect.width;
          const clampedProgress = Math.max(minProgress, Math.min(maxProgress, rawFraction));
          const nearestIndex = Math.max(0, Math.min(numOptions - 1, Math.floor(rawFraction * numOptions)));
          return { progress: clampedProgress, index: nearestIndex };
        }
      }

      // Fallback for jsdom / zero width
      const el = (targetNode as HTMLElement | null)?.closest?.('[data-index]');
      if (el) {
        const idx = Math.max(0, Math.min(numOptions - 1, parseInt(el.getAttribute('data-index') ?? '0', 10)));
        return { progress: (idx + 0.5) / numOptions, index: idx };
      }

      return { progress: (currentIndex + 0.5) / numOptions, index: currentIndex };
    },
    [numOptions, currentIndex],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || numOptions <= 0) return;
    pointerOriginRef.current = { x: e.clientX, y: e.clientY, moved: false };

    if (typeof e.currentTarget.setPointerCapture === 'function') {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerOriginRef.current) return;

    const dx = Math.abs(e.clientX - pointerOriginRef.current.x);
    if (!pointerOriginRef.current.moved && dx > 3) {
      pointerOriginRef.current.moved = true;
      setIsDragging(true);
    }

    if (pointerOriginRef.current.moved) {
      const { progress, index } = getProgressAndIndex(e.clientX, e.target);
      setDragProgress(progress);
      setDragIndex(index);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerOriginRef.current) return;
    pointerOriginRef.current = null;

    if (typeof e.currentTarget.releasePointerCapture === 'function') {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    const { index } = getProgressAndIndex(e.clientX, e.target);
    setIsDragging(false);
    setDragProgress(null);
    setDragIndex(null);

    const targetOption = option.options[index];
    if (targetOption && targetOption.value !== option.currentValue) {
      onChange(targetOption.value);
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    pointerOriginRef.current = null;
    if (typeof e.currentTarget.releasePointerCapture === 'function') {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    setIsDragging(false);
    setDragProgress(null);
    setDragIndex(null);
  };

  const handleTrackKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled || numOptions <= 0) return;
    let nextIndex = currentIndex;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      nextIndex = Math.max(0, currentIndex - 1);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      nextIndex = Math.min(numOptions - 1, currentIndex + 1);
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = numOptions - 1;
    } else {
      return;
    }
    e.preventDefault();
    if (option.options[nextIndex] && option.options[nextIndex].value !== option.currentValue) {
      onChange(option.options[nextIndex].value);
    }
  };

  const thumbPercent =
    isDragging && dragProgress !== null
      ? dragProgress * 100
      : numOptions > 0
      ? ((currentIndex + 0.5) / numOptions) * 100
      : 50;

  const recommendedPercent =
    numOptions > 0 ? ((recommendedIndex + 0.5) / numOptions) * 100 : 50;

  const popover = isOpen ? (
    createPortal(
      <div
        ref={popoverRef}
        className="effort-popover-card"
        role="dialog"
        aria-label="Effort selector"
        style={popoverStyle}
      >
        {/* Header line: Effort <Level> + (?) */}
        <div className="effort-popover-header">
          <div className="effort-popover-title-row">
            <span className="effort-popover-label">Effort</span>
            <span key={label} className="effort-popover-value">
              {label}
            </span>
          </div>
          <span
            className="effort-popover-help"
            title="Controls reasoning effort and thinking budget"
            aria-label="Help"
          >
            ?
          </span>
        </div>

        {/* Subheader: Faster ... Smarter */}
        <div className="effort-scale-row">
          <span className="effort-scale-side">Faster</span>
          <span className="effort-scale-side">Smarter</span>
        </div>

        {/* Segmented slider track */}
        <div
          ref={trackRef}
          className={`effort-slider-track${isDragging ? ' dragging' : ''}`}
          role="slider"
          aria-label="Reasoning effort"
          aria-valuemin={0}
          aria-valuemax={numOptions - 1}
          aria-valuenow={displayIndex}
          aria-valuetext={label}
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onKeyDown={handleTrackKeyDown}
        >
          {/* Animated floating thumb */}
          <div
            className={`effort-slider-thumb${isDragging ? ' dragging' : ''}`}
            aria-hidden="true"
            style={{
              left: `${thumbPercent}%`,
              transition: isDragging
                ? 'none'
                : 'left 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.15s ease, box-shadow 0.15s ease',
            }}
          />

          {/* Stop markers */}
          {option.options.map((item, idx) => {
            const isRecommended = item.name.toLowerCase() === 'medium';
            const isSelected = idx === displayIndex;
            return (
              <div
                key={item.value}
                data-index={idx}
                className={`effort-slider-stop${isSelected ? ' selected' : ''}`}
                title={`${item.name} effort`}
              >
                {isRecommended ? (
                  <span className="effort-slider-notch" aria-hidden="true" />
                ) : (
                  <span className="effort-slider-dot" aria-hidden="true" />
                )}
              </div>
            );
          })}
        </div>

        {/* Footer label: Recommended under medium */}
        <div className="effort-recommended-row">
          <span
            className="effort-recommended-text"
            style={{ left: `${recommendedPercent}%` }}
          >
            Recommended
          </span>
        </div>
      </div>,
      document.body,
    )
  ) : null;

  return (
    <div className="effort-pill-wrap">
      <button
        ref={triggerRef}
        type="button"
        className={`effort-pill-btn${isOpen ? ' active' : ''}`}
        onClick={onToggle}
        disabled={disabled}
        title={`Reasoning effort: ${label}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        {label}
      </button>
      {popover}
    </div>
  );
}
