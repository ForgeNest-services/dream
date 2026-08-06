'use client';

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MdMoreHoriz } from 'react-icons/md';
import { colors, spacing, radius } from '@/lib/design-tokens';

interface DropdownMenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  tone?: 'default' | 'danger';
}

interface DropdownMenuProps {
  items: DropdownMenuItem[];
  triggerLabel?: string;
}

// Portals the menu to document.body and positions it via the trigger's
// bounding rect — escapes any ancestor with overflow:hidden/auto (e.g. a
// horizontally-scrollable table wrapper), which position:absolute cannot.
export function DropdownMenu({ items, triggerLabel = 'Open actions menu' }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = () => setOpen(false);

  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setCoords({ top: rect.bottom + 6, left: rect.right - 170 });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close();
    }
    function onScrollOrResize() {
      close();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }

    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => (open ? close() : openMenu())}
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.sm,
          border: `1px solid ${open ? colors.neutral[300] : 'transparent'}`,
          backgroundColor: open ? colors.neutral[50] : 'transparent',
          color: colors.neutral[600],
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          if (!open) e.currentTarget.style.backgroundColor = colors.neutral[50];
        }}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <MdMoreHoriz size={18} />
      </button>

      {open && coords && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{
                position: 'fixed',
                top: coords.top,
                left: coords.left,
                minWidth: '170px',
                backgroundColor: colors.neutral[0],
                border: `1px solid ${colors.neutral[200]}`,
                borderRadius: radius.md,
                boxShadow: '0 12px 32px rgba(10, 41, 71, 0.16)',
                overflow: 'hidden',
                zIndex: 1000,
              }}
            >
              {items.map((item) => (
                <button
                  key={item.label}
                  role="menuitem"
                  onClick={() => {
                    close();
                    item.onSelect();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.sm,
                    width: '100%',
                    padding: `${spacing.sm} ${spacing.md}`,
                    border: 'none',
                    background: 'transparent',
                    color: item.tone === 'danger' ? colors.status.error : colors.neutral[800],
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      item.tone === 'danger' ? `${colors.status.error}0D` : colors.neutral[50])
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
