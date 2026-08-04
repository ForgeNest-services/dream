'use client';

import { useAuth } from '@/hooks/useAuth';
import { colors, spacing } from '@/lib/design-tokens';
import { AppsGrid } from '@/components/dashboard/AppsGrid';
import { BusinessSetupDialog } from '@/components/dashboard/BusinessSetupDialog';

export function DashboardContent() {
  const { user, isSuperAdmin, tenant } = useAuth();

  const userName = user && 'full_name' in user ? user.full_name : user?.email;
  const needsBusinessSetup = !isSuperAdmin && !tenant;

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2xl'] }}>
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
                : 'One more step to unlock your apps.'}
          </p>
        </div>

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

      {needsBusinessSetup && <BusinessSetupDialog />}
    </>
  );
}
