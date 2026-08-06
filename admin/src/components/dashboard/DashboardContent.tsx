'use client';

import { useAuth } from '@/hooks/useAuth';
import { useApps } from '@/hooks/useApps';
import { colors, spacing, radius } from '@/lib/design-tokens';
import { AppsGrid } from '@/components/dashboard/AppsGrid';
import { BusinessSetupDialog } from '@/components/dashboard/BusinessSetupDialog';
import { HospitalityMark } from '@/components/shared/HospitalityMark';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardContent() {
  const { user, isSuperAdmin, tenant } = useAuth();
  const { apps, isLoading: appsLoading } = useApps();

  const firstName =
    user && 'full_name' in user && user.full_name ? user.full_name.split(' ')[0] : user?.email?.split('@')[0];
  const needsBusinessSetup = !isSuperAdmin && !tenant;
  const showEmptyState = !isSuperAdmin && tenant && !appsLoading && apps.length === 0;

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2xl'] }}>
        <div>
          <p
            style={{
              fontSize: '13px',
              fontWeight: '600',
              color: colors.primary[500],
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              margin: 0,
              marginBottom: spacing.xs,
            }}
          >
            {greeting()}
          </p>
          <h1
            style={{
              fontSize: '32px',
              fontWeight: '700',
              color: colors.neutral[900],
              margin: 0,
              fontFamily: 'var(--font-playfair)',
            }}
          >
            {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
          </h1>
          <p
            style={{
              fontSize: '15px',
              color: colors.neutral[600],
              marginTop: spacing.sm,
            }}
          >
            {isSuperAdmin
              ? 'Admin control panel'
              : tenant
                ? `Here's what's running at ${tenant.name} today.`
                : 'One more step to unlock your apps.'}
          </p>
        </div>

        {!isSuperAdmin && tenant && !showEmptyState && (
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
              Your apps
            </h2>
            <AppsGrid />
          </section>
        )}

        {showEmptyState && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              padding: `${spacing['3xl']} ${spacing.xl}`,
              border: `1px dashed ${colors.neutral[300]}`,
              borderRadius: radius.lg,
              backgroundColor: colors.neutral[0],
            }}
          >
            <HospitalityMark size={88} />
            <p style={{ fontSize: '16px', fontWeight: '700', color: colors.neutral[900], margin: 0, marginTop: spacing.lg }}>
              No apps assigned yet
            </p>
            <p style={{ fontSize: '14px', color: colors.neutral[600], marginTop: spacing.xs, maxWidth: '360px' }}>
              Once an app is added to your account, it'll open right here — ready to set up staff logins and go live.
            </p>
          </div>
        )}
      </div>

      {needsBusinessSetup && <BusinessSetupDialog />}
    </>
  );
}
