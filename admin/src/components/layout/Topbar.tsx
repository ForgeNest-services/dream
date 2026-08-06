'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MdMenu, MdLogout, MdKeyboardArrowDown } from 'react-icons/md';
import { useAuth } from '@/hooks/useAuth';
import { colors, spacing, radius, layout } from '@/lib/design-tokens';
import { Avatar } from '@/components/ui/Avatar';
import { useSidebar } from './SidebarContext';

export function Topbar({ title }: { title?: string }) {
  const { user, userRole, isSuperAdmin, logout } = useAuth();
  const { setMobileOpen, isDesktop } = useSidebar();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const displayName = 'full_name' in user && user.full_name ? user.full_name : user.email;
  const roleLabel = isSuperAdmin ? 'Superadmin' : userRole || 'User';

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        height: layout.topbarHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
        padding: `0 ${spacing.xl}`,
        backgroundColor: colors.neutral[0],
        borderBottom: `1px solid ${colors.neutral[200]}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, minWidth: 0 }}>
        {!isDesktop && (
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            style={{
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.sm,
              border: `1px solid ${colors.neutral[200]}`,
              backgroundColor: colors.neutral[0],
              color: colors.neutral[700],
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <MdMenu size={20} />
          </button>
        )}
        {title && (
          <h2
            style={{
              fontSize: '16px',
              fontWeight: '600',
              color: colors.neutral[900],
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </h2>
        )}
      </div>

      <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.sm,
            padding: `${spacing.xs} ${spacing.sm}`,
            borderRadius: radius.full,
            border: 'none',
            backgroundColor: menuOpen ? colors.neutral[100] : 'transparent',
            cursor: 'pointer',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.neutral[100])}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = menuOpen ? colors.neutral[100] : 'transparent')}
        >
          <Avatar
            src={'picture_url' in user ? user.picture_url : null}
            name={'full_name' in user ? user.full_name : null}
            email={user.email}
            size={36}
          />
          <span style={{ display: 'none', textAlign: 'left' }} className="topbar-user-text">
            <span
              style={{
                display: 'block',
                textAlign: 'left',
                fontSize: '13px',
                fontWeight: '600',
                color: colors.neutral[900],
                lineHeight: '1.3',
                maxWidth: '160px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {displayName}
            </span>
            <span
              style={{
                display: 'block',
                textAlign: 'left',
                fontSize: '11px',
                fontWeight: '500',
                color: colors.neutral[500],
                textTransform: 'capitalize',
              }}
            >
              {roleLabel}
            </span>
          </span>
          <MdKeyboardArrowDown size={18} color={colors.neutral[400]} />
        </button>

        {menuOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              minWidth: '220px',
              backgroundColor: colors.neutral[0],
              border: `1px solid ${colors.neutral[200]}`,
              borderRadius: radius.md,
              boxShadow: '0 12px 32px rgba(10, 41, 71, 0.12)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: spacing.md, borderBottom: `1px solid ${colors.neutral[100]}` }}>
              <p
                style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: colors.neutral[900],
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {displayName}
              </p>
              <p
                style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: colors.primary[500],
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                  margin: 0,
                  marginTop: '2px',
                }}
              >
                {roleLabel}
              </p>
            </div>
            <button
              onClick={handleLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.sm,
                width: '100%',
                padding: spacing.md,
                border: 'none',
                background: 'transparent',
                color: colors.status.error,
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.neutral[50])}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <MdLogout size={16} />
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
