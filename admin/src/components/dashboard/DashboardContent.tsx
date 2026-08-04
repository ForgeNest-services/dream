'use client';

import { useAuth } from '@/hooks/useAuth';
import { MdArrowForward } from 'react-icons/md';
import { colors, spacing } from '@/lib/design-tokens';
import { AppsGrid } from '@/components/dashboard/AppsGrid';

export function DashboardContent() {
  const { user, isSuperAdmin, tenant } = useAuth();

  const userName = user && 'full_name' in user ? user.full_name : user?.email;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2xl'] }}>
      {/* Header */}
      <div>
        <h1
          style={{
            fontSize: '32px',
            fontWeight: '700',
            color: colors.neutral[900],
            marginBottom: spacing.sm,
            fontFamily: 'var(--font-playfair)',
          }}
        >
          Welcome, {userName}!
        </h1>
        <p
          style={{
            fontSize: '16px',
            color: colors.neutral[600],
            marginTop: spacing.sm,
          }}
        >
          {isSuperAdmin
            ? 'Admin Control Panel'
            : tenant
              ? 'Manage your apps and staff credentials'
              : 'Get started by completing your business registration'}
        </p>
      </div>

      {/* Business registration nudge if tenant not set */}
      {!isSuperAdmin && !tenant && (
        <div
          style={{
            backgroundColor: `${colors.primary[800]}0d`,
            border: `1px solid ${colors.primary[800]}30`,
            borderRadius: '12px',
            padding: spacing.lg,
            display: 'flex',
            flexDirection: 'column',
            gap: spacing.md,
          }}
        >
          <p
            style={{
              color: colors.neutral[900],
              fontWeight: '500',
              fontSize: '14px',
            }}
          >
            Complete your business registration to unlock your apps.
          </p>
          <a
            href="/business-register"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: spacing.sm,
              paddingLeft: spacing.lg,
              paddingRight: spacing.lg,
              paddingTop: spacing.md,
              paddingBottom: spacing.md,
              backgroundColor: colors.primary[800],
              color: colors.neutral[0],
              borderRadius: '24px',
              fontWeight: '600',
              fontSize: '14px',
              textDecoration: 'none',
              width: 'fit-content',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.primary[700];
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = colors.primary[800];
            }}
          >
            Complete Registration
            <MdArrowForward size={18} />
          </a>
        </div>
      )}

      {/* Apps grid — only shown to tenant users */}
      {!isSuperAdmin && tenant && (
        <section>
          <h2
            style={{
              fontSize: '13px',
              fontWeight: '600',
              color: colors.neutral[500],
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              marginBottom: spacing.lg,
            }}
          >
            Your Apps
          </h2>
          <AppsGrid />
        </section>
      )}
    </div>
  );
}
