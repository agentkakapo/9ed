import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  const currentOption = option.options.find((o) => o.value === option.currentValue) ?? option.options[0];
  const rawLabel = currentOption?.name ?? option.currentValue ?? 'Medium';
  const label = cleanOptionName(rawLabel, option.id, currentOption?.description);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

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
      // Center or align horizontally with the trigger, keeping within screen bounds
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
            <span className="effort-popover-value">{label}</span>
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
        <div className="effort-slider-track" role="radiogroup" aria-label="Reasoning effort">
          {option.options.map((item) => {
            const isSelected = item.value === option.currentValue;
            const isRecommended = item.name.toLowerCase() === 'medium';
            return (
              <button
                key={item.value}
                type="button"
                className={`effort-slider-stop${isSelected ? ' selected' : ''}`}
                onClick={() => {
                  onChange(item.value);
                }}
                role="radio"
                aria-checked={isSelected}
                title={`${item.name} effort`}
              >
                {isSelected ? (
                  <span className="effort-slider-thumb" aria-hidden="true" />
                ) : isRecommended ? (
                  <span className="effort-slider-notch" aria-hidden="true" />
                ) : (
                  <span className="effort-slider-dot" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>

        {/* Footer label: Recommended under medium */}
        <div className="effort-recommended-row">
          <span className="effort-recommended-text">Recommended</span>
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
