import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ConfigOptionInfo, ConfigValueInfo } from '../../types';

export type ModelDropdownProps = {
  option: ConfigOptionInfo;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function getModelBadge(item: ConfigValueInfo): { text: string; icon?: string } | null {
  const desc = (item.description ?? '').toLowerCase();
  const name = item.name.toLowerCase();
  const val = item.value.toLowerCase();

  // Usage credits badge
  if (
    desc.includes('usage credit') ||
    desc.includes('requires usage credit') ||
    desc.includes('credit') ||
    name.includes('fable') ||
    val.includes('fable')
  ) {
    return { text: 'Requires usage credits', icon: 'ⓘ' };
  }

  // Reasoning badge
  if (
    desc.includes('reasoning') ||
    desc.includes('thinking') ||
    name.includes('reasoning') ||
    val.includes('reasoning')
  ) {
    return { text: 'Reasoning' };
  }

  if (item.description && item.description.length <= 16 && !item.description.includes('.')) {
    return { text: item.description };
  }

  return null;
}

export function ModelDropdown({
  option,
  isOpen,
  onToggle,
  onClose,
  onChange,
  disabled,
}: ModelDropdownProps) {
  const currentOption = option.options.find((o) => o.value === option.currentValue);
  const label = currentOption?.name ?? option.currentValue ?? 'Select model';

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const mainMenuRef = useRef<HTMLDivElement | null>(null);
  const submenuRef = useRef<HTMLDivElement | null>(null);
  const moreTriggerRef = useRef<HTMLButtonElement | null>(null);

  const [submenuOpen, setSubmenuOpen] = useState(false);
  const submenuTimerRef = useRef<number | null>(null);

  const [mainStyle, setMainStyle] = useState<React.CSSProperties>({});
  const [subStyle, setSubStyle] = useState<React.CSSProperties>({});

  const isMultiTier = option.options.length > 4;
  const primaryModels = isMultiTier ? option.options.slice(0, 4) : option.options;
  const olderModels = isMultiTier ? option.options.slice(4) : [];

  // Update main dropdown position
  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const width = Math.min(360, Math.max(280, Math.floor(window.innerWidth * 0.26)));
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
      const gap = 6;
      const aboveSpace = rect.top - 12 - gap;
      const belowSpace = window.innerHeight - rect.bottom - 12 - gap;
      const opensUpward = aboveSpace >= 160 || aboveSpace >= belowSpace;

      if (opensUpward) {
        const bottom = window.innerHeight - rect.top + gap;
        const maxHeight = Math.max(120, Math.min(480, aboveSpace));
        setMainStyle({
          position: 'fixed',
          left: `${left}px`,
          bottom: `${bottom}px`,
          width: `${width}px`,
          maxHeight: `${maxHeight}px`,
        });
      } else {
        const top = rect.bottom + gap;
        const maxHeight = Math.max(120, Math.min(480, belowSpace));
        setMainStyle({
          position: 'fixed',
          left: `${left}px`,
          top: `${top}px`,
          width: `${width}px`,
          maxHeight: `${maxHeight}px`,
        });
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  // Update flyout submenu position
  useLayoutEffect(() => {
    if (!isOpen || !submenuOpen || !mainMenuRef.current) return;

    const updateSubmenuPosition = () => {
      if (!mainMenuRef.current) return;
      const mainRect = mainMenuRef.current.getBoundingClientRect();
      const subWidth = Math.min(340, Math.max(260, Math.floor(window.innerWidth * 0.25)));
      const gap = 4;

      const spaceLeft = mainRect.left - 12;
      const spaceRight = window.innerWidth - mainRect.right - 12;
      const opensLeft = spaceLeft >= subWidth && (spaceRight < subWidth || mainRect.right > window.innerWidth * 0.45);
      const subLeft = opensLeft
        ? Math.max(12, mainRect.left - subWidth - gap)
        : Math.min(window.innerWidth - subWidth - 12, mainRect.right + gap);

      const isAnchoredBottom = mainStyle.bottom !== undefined;
      if (isAnchoredBottom) {
        const subBottom = window.innerHeight - mainRect.bottom;
        const maxHeight = Math.max(140, Math.min(500, window.innerHeight - subBottom - 24));
        setSubStyle({
          position: 'fixed',
          left: `${subLeft}px`,
          bottom: `${subBottom}px`,
          width: `${subWidth}px`,
          maxHeight: `${maxHeight}px`,
        });
      } else {
        const subTop = Math.max(12, mainRect.top);
        const maxHeight = Math.max(140, Math.min(500, window.innerHeight - subTop - 24));
        setSubStyle({
          position: 'fixed',
          left: `${subLeft}px`,
          top: `${subTop}px`,
          width: `${subWidth}px`,
          maxHeight: `${maxHeight}px`,
        });
      }
    };

    updateSubmenuPosition();
    window.addEventListener('resize', updateSubmenuPosition);
    window.addEventListener('scroll', updateSubmenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateSubmenuPosition);
      window.removeEventListener('scroll', updateSubmenuPosition, true);
    };
  }, [isOpen, submenuOpen, mainStyle]);

  const openSubmenu = () => {
    if (submenuTimerRef.current) {
      window.clearTimeout(submenuTimerRef.current);
      submenuTimerRef.current = null;
    }
    setSubmenuOpen(true);
  };

  const closeSubmenuWithDelay = () => {
    if (submenuTimerRef.current) {
      window.clearTimeout(submenuTimerRef.current);
    }
    submenuTimerRef.current = window.setTimeout(() => {
      setSubmenuOpen(false);
    }, 200);
  };

  useEffect(() => {
    return () => {
      if (submenuTimerRef.current) {
        window.clearTimeout(submenuTimerRef.current);
      }
    };
  }, []);

  // Handle click outside
  useEffect(() => {
    if (!isOpen) {
      setSubmenuOpen(false);
      return;
    }

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (mainMenuRef.current?.contains(target)) return;
      if (submenuRef.current?.contains(target)) return;
      setSubmenuOpen(false);
      onClose();
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen, onClose]);

  // Handle keyboard shortcuts (1-4, Escape)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setSubmenuOpen(false);
        onClose();
        return;
      }
      if (['1', '2', '3', '4'].includes(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        if (primaryModels[idx]) {
          e.preventDefault();
          onChange(primaryModels[idx].value);
          setSubmenuOpen(false);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, primaryModels, onChange, onClose]);

  return (
    <div className="chat-picker-wrap chat-picker-wrap-rich chat-picker-wrap-model">
      <button
        ref={triggerRef}
        className="agent-picker agent-picker-rich model-picker-trigger"
        onClick={onToggle}
        type="button"
        title={option.name}
        disabled={disabled}
        data-active={isOpen ? 'true' : 'false'}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span className="agent-picker-label agent-picker-label-multiline">{label}</span>
        <span className="agent-picker-caret" aria-hidden="true">▾</span>
      </button>

      {isOpen && createPortal(
        <div
          ref={mainMenuRef}
          className="model-menu-dropdown"
          style={mainStyle}
          role="menu"
          aria-label="Select Model"
        >
          {primaryModels.map((item, idx) => {
            const isSelected = item.value === option.currentValue;
            const badge = getModelBadge(item);
            return (
              <button
                key={item.value}
                type="button"
                className="model-menu-item"
                data-active={isSelected ? 'true' : 'false'}
                onClick={() => {
                  onChange(item.value);
                  setSubmenuOpen(false);
                  onClose();
                }}
                role="menuitem"
              >
                <div className="model-menu-item-left">
                  <span className="model-menu-item-name">{item.name}</span>
                  {badge && (
                    <span className="model-badge">
                      {badge.icon && <span className="model-badge-icon">{badge.icon}</span>}
                      {badge.text}
                    </span>
                  )}
                </div>
                <div className="model-menu-item-right">
                  {isSelected ? (
                    <span className="model-item-check" aria-label="Active model">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  ) : (
                    <span className="model-item-shortcut">{idx + 1}</span>
                  )}
                </div>
              </button>
            );
          })}

          {olderModels.length > 0 && (
            <>
              <div className="model-menu-divider" />
              <button
                ref={moreTriggerRef}
                type="button"
                className="model-menu-item model-more-trigger"
                data-active={submenuOpen ? 'true' : 'false'}
                onMouseEnter={openSubmenu}
                onMouseOver={openSubmenu}
                onMouseLeave={closeSubmenuWithDelay}
                onClick={() => setSubmenuOpen(!submenuOpen)}
                role="menuitem"
                aria-haspopup="true"
                aria-expanded={submenuOpen}
              >
                <span className="model-menu-item-name">More models</span>
                <span className="model-more-chevron">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </span>
              </button>
            </>
          )}
        </div>,
        document.body,
      )}

      {isOpen && submenuOpen && olderModels.length > 0 && createPortal(
        <div
          ref={submenuRef}
          className="model-submenu-dropdown"
          style={subStyle}
          onMouseEnter={openSubmenu}
          onMouseOver={openSubmenu}
          onMouseLeave={closeSubmenuWithDelay}
          role="menu"
          aria-label="Older Models"
        >
          {olderModels.map((item) => {
            const isSelected = item.value === option.currentValue;
            const badge = getModelBadge(item);
            return (
              <button
                key={item.value}
                type="button"
                className="model-menu-item"
                data-active={isSelected ? 'true' : 'false'}
                onClick={() => {
                  onChange(item.value);
                  setSubmenuOpen(false);
                  onClose();
                }}
                role="menuitem"
              >
                <div className="model-menu-item-left">
                  <span className="model-menu-item-name">{item.name}</span>
                  {badge && (
                    <span className="model-badge">
                      {badge.icon && <span className="model-badge-icon">{badge.icon}</span>}
                      {badge.text}
                    </span>
                  )}
                </div>
                <div className="model-menu-item-right">
                  {isSelected && (
                    <span className="model-item-check" aria-label="Active model">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
