'use client';

import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  MdDashboard,
  MdApps,
  MdOutlineBusiness,
  MdPeople,
  MdSettings,
  MdShield,
  MdChevronLeft,
  MdOutlineMailOutline,
} from 'react-icons/md';
import { colors, spacing, radius, layout } from '@/lib/design-tokens';
import { useSidebar } from './SidebarContext';

const navigationItems = [
  { label: 'Dashboard', href: '/dashboard', icon: MdDashboard, roles: ['owner', 'manager'] },
  { label: 'Apps', href: '/dashboard/apps', icon: MdApps, roles: ['owner', 'manager'] },
  { label: 'Branches', href: '/dashboard/branches', icon: MdOutlineBusiness, roles: ['owner', 'manager'] },
  // Team Members: commented out for launch, not needed yet. Page/API stay
  // intact — see app/dashboard/team/page.tsx's redirect.
  // { label: 'Team Members', href: '/dashboard/team', icon: MdPeople, roles: ['owner'] },
  { label: 'Settings', href: '/dashboard/settings', icon: MdSettings, roles: ['owner'] },
  { label: 'Admin Panel', href: '/dashboard/admin', icon: MdShield, roles: ['superadmin'] },
  { label: 'Queries', href: '/dashboard/queries', icon: MdOutlineMailOutline, roles: ['superadmin'] },
];

export function Sidebar() {
  const { user, userRole, isSuperAdmin } = useAuth();
  const pathname = usePathname();
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen, isDesktop } = useSidebar();

  if (!user) return null;

  const visibleItems = navigationItems.filter((item) =>
    isSuperAdmin ? item.roles.includes('superadmin') : userRole ? item.roles.includes(userRole) : false,
  );

  const railWidth = collapsed ? layout.sidebarCollapsedWidth : layout.sidebarWidth;
  const showLabels = !collapsed || !isDesktop;

  return (
    <>
      <aside
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          width: isDesktop ? railWidth : layout.sidebarWidth,
          backgroundColor: colors.primary[800],
          color: colors.neutral[0],
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
          transform: isDesktop ? 'translateX(0)' : mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'width 0.2s ease, transform 0.25s ease',
          overflow: 'hidden',
        }}
      >
        {/* Brand */}
        <div
          style={{
            height: layout.topbarHeight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: showLabels ? 'space-between' : 'center',
            padding: `0 ${showLabels ? spacing.lg : spacing.sm}`,
            borderBottom: `1px solid ${colors.primary[700]}`,
            flexShrink: 0,
          }}
        >
          {showLabels && (
            <Image
              src="/logo-white.png"
              alt="Srota"
              width={789}
              height={290}
              priority
              style={{ height: '48px', width: 'auto' }}
            />
          )}
          {isDesktop && (
            <button
              onClick={toggleCollapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              style={{
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.sm,
                border: 'none',
                backgroundColor: 'transparent',
                color: colors.neutral[300],
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.primary[700])}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <MdChevronLeft
                size={20}
                style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
              />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav
          style={{
            flex: 1,
            padding: spacing.md,
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                title={!showLabels ? item.label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.md,
                  padding: showLabels ? `${spacing.sm} ${spacing.md}` : spacing.sm,
                  justifyContent: showLabels ? 'flex-start' : 'center',
                  borderRadius: radius.sm,
                  backgroundColor: isActive ? colors.neutral[0] : 'transparent',
                  color: isActive ? colors.primary[800] : colors.neutral[300],
                  textDecoration: 'none',
                  transition: 'background-color 0.15s, color 0.15s',
                  fontSize: '14px',
                  fontWeight: isActive ? '600' : '500',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = colors.primary[700];
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Icon size={20} style={{ flexShrink: 0 }} />
                {showLabels && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && !isDesktop && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(10, 41, 71, 0.5)',
            zIndex: 30,
          }}
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
}
