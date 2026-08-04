'use client';

import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';
import { MdMenu, MdClose, MdDashboard, MdPeople, MdSettings, MdShield, MdLogout } from 'react-icons/md';
import { colors, spacing } from '@/lib/design-tokens';
import { Avatar } from '@/components/ui/Avatar';

const navigationItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: MdDashboard,
    roles: ['owner', 'manager'],
  },
  {
    label: 'Team Members',
    href: '/dashboard/team',
    icon: MdPeople,
    roles: ['owner'],
  },
  {
    label: 'Settings',
    href: '/dashboard/settings',
    icon: MdSettings,
    roles: ['owner'],
  },
  {
    label: 'Admin Panel',
    href: '/admin',
    icon: MdShield,
    roles: ['superadmin'],
  },
];

export function Sidebar() {
  const { user, userRole, logout, isOwner, isSuperAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    router.push('/');
    setIsOpen(false);
  };

  // Determine which navigation items to show
  const visibleItems = navigationItems.filter((item) => {
    if (isSuperAdmin) {
      return item.roles.includes('superadmin');
    }
    if (!userRole) {
      return false;
    }
    return item.roles.includes(userRole);
  });

  return (
    <>
      {/* Mobile toggle - only show on mobile */}
      {typeof window !== 'undefined' && window.innerWidth < 1024 && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            position: 'fixed',
            top: spacing.md,
            left: spacing.md,
            zIndex: 50,
            padding: spacing.sm,
            borderRadius: '8px',
            backgroundColor: colors.neutral[900],
            color: colors.neutral[0],
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '44px',
            height: '44px',
          }}
        >
          {isOpen ? <MdClose size={24} /> : <MdMenu size={24} />}
        </button>
      )}

      {/* Sidebar */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          width: '256px',
          backgroundColor: colors.neutral[900],
          color: colors.neutral[0],
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
          transform: typeof window !== 'undefined' && window.innerWidth < 1024
            ? (isOpen ? 'translateX(0)' : 'translateX(-100%)')
            : 'translateX(0)',
          transition: 'transform 0.3s ease',
        }}
      >
        {/* Logo/Brand */}
        <div style={{
          padding: spacing.lg,
          borderBottom: `1px solid ${colors.neutral[700]}`,
        }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: '700',
            color: colors.neutral[0],
            fontFamily: 'var(--font-playfair)',
          }}>
            Dream
          </h1>
        </div>

        {/* User Profile */}
        <div style={{
          padding: spacing.lg,
          borderBottom: `1px solid ${colors.neutral[700]}`,
          display: 'flex',
          alignItems: 'center',
          gap: spacing.md,
        }}>
          <Avatar
            src={'picture_url' in user ? user.picture_url : null}
            name={'full_name' in user ? user.full_name : null}
            email={user.email}
            size={44}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: '14px',
              fontWeight: '600',
              color: colors.neutral[0],
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {'full_name' in user && user.full_name ? user.full_name : user.email}
            </p>
            <p style={{
              fontSize: '12px',
              color: colors.neutral[400],
              textTransform: 'capitalize',
              marginTop: '2px',
            }}>
              {isSuperAdmin ? 'Superadmin' : userRole || 'User'}
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{
          flex: 1,
          padding: spacing.lg,
          display: 'flex',
          flexDirection: 'column',
          gap: spacing.xs,
          overflowY: 'auto',
        }}>
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingLeft: spacing.md,
                  paddingRight: spacing.md,
                  paddingTop: spacing.sm,
                  paddingBottom: spacing.sm,
                  borderRadius: '8px',
                  backgroundColor: isActive ? colors.primary[400] : 'transparent',
                  color: isActive ? colors.neutral[0] : colors.neutral[300],
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = colors.neutral[800];
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div style={{
          padding: spacing.lg,
          borderTop: `1px solid ${colors.neutral[700]}`,
        }}>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.md,
              paddingLeft: spacing.md,
              paddingRight: spacing.md,
              paddingTop: spacing.sm,
              paddingBottom: spacing.sm,
              borderRadius: '8px',
              width: '100%',
              backgroundColor: 'transparent',
              color: colors.neutral[300],
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.neutral[800];
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <MdLogout size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile overlay - only show on mobile when open */}
      {isOpen && typeof window !== 'undefined' && window.innerWidth < 1024 && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 30,
          }}
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
