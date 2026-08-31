'use client';

import Link from 'next/link';
import {
  MdArrowBack,
  MdOutlineArrowOutward,
  MdOutlineHotel,
  MdOutlineRestaurant,
  MdOutlineFitnessCenter,
  MdOutlineInventory2,
  MdOutlinePool,
  MdOutlineApps,
} from 'react-icons/md';
import { IconType } from 'react-icons';
import { useApps, useAppDetail } from '@/hooks/useApps';
import { useBranches } from '@/hooks/useBranches';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { APP_CODE_TO_ROLES } from '@/types/apps';
import { colors, spacing } from '@/lib/design-tokens';
import { Spinner } from '@/components/shared/Spinner';
import { CredentialsSection } from '@/components/dashboard/CredentialsSection';
import { SubscriptionSection } from '@/components/dashboard/SubscriptionSection';

const ICON_MAP: Record<string, IconType> = {
  Hotel: MdOutlineHotel,
  Restaurant: MdOutlineRestaurant,
  Fitness: MdOutlineFitnessCenter,
  Inventory: MdOutlineInventory2,
  Pool: MdOutlinePool,
};

export function AppDetailContent({ slug }: { slug: string }) {
  const { app, isLoading, error } = useAppDetail(slug);
  const { apps: allApps } = useApps();
  const { branches, isLoading: branchesLoading } = useBranches();
  const { forApp, submitPayment, quotePrice } = useSubscriptions();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: spacing['3xl'] }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !app) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
        <Link
          href="/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: spacing.xs,
            color: colors.neutral[600],
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: '500',
            width: 'fit-content',
          }}
        >
          <MdArrowBack size={18} />
          Back to dashboard
        </Link>
        <div
          style={{
            padding: spacing.xl,
            backgroundColor: `${colors.status.error}10`,
            border: `1px solid ${colors.status.error}30`,
            borderRadius: '12px',
            color: colors.status.error,
          }}
        >
          {error?.message || `App '${slug}' not found.`}
        </div>
      </div>
    );
  }

  const Icon = (app.icon && ICON_MAP[app.icon]) || MdOutlineApps;
  const rolesForApp = APP_CODE_TO_ROLES[app.code];
  const credentialsSupported = Boolean(rolesForApp);
  const sub = forApp(app.code);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2xl'] }}>
      {/* Back link */}
      <Link
        href="/dashboard"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: spacing.xs,
          color: colors.neutral[600],
          textDecoration: 'none',
          fontSize: '14px',
          fontWeight: '500',
          width: 'fit-content',
        }}
      >
        <MdArrowBack size={18} />
        Back to dashboard
      </Link>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: spacing.lg,
          padding: spacing.xl,
          backgroundColor: colors.neutral[0],
          border: `1px solid ${colors.neutral[200]}`,
          borderRadius: '16px',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {app.icon_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={app.icon_url}
              alt={`${app.name} logo`}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <Icon size={32} color={colors.primary[800]} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: '700',
              color: colors.neutral[900],
              margin: 0,
              fontFamily: 'var(--font-playfair)',
            }}
          >
            {app.name}
          </h1>
          {app.description && (
            <p
              style={{
                fontSize: '14px',
                color: colors.neutral[600],
                marginTop: spacing.sm,
                marginBottom: 0,
                lineHeight: '1.6',
              }}
            >
              {app.description}
            </p>
          )}
        </div>
        <a
          href={app.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: spacing.xs,
            padding: `${spacing.md} ${spacing.lg}`,
            borderRadius: '24px',
            border: `1px solid ${colors.primary[800]}`,
            backgroundColor: colors.primary[800],
            color: colors.neutral[0],
            fontSize: '14px',
            fontWeight: '600',
            textDecoration: 'none',
            flexShrink: 0,
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.primary[700];
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = colors.primary[800];
          }}
        >
          Open App
          <MdOutlineArrowOutward size={16} />
        </a>
      </div>

      {/* Subscription section */}
      <section>
        <h2
          style={{
            fontSize: '13px',
            fontWeight: '600',
            color: colors.neutral[500],
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            marginBottom: spacing.md,
          }}
        >
          Subscription
        </h2>
        <SubscriptionSection
          appCode={app.code}
          sub={sub}
          onSubmitPayment={submitPayment}
          quotePrice={quotePrice}
          allApps={allApps}
        />
      </section>

      {/* Credentials section */}
      <section>
        <h2
          style={{
            fontSize: '13px',
            fontWeight: '600',
            color: colors.neutral[500],
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            marginBottom: spacing.md,
          }}
        >
          Staff Credentials
        </h2>
        <p
          style={{
            fontSize: '14px',
            color: colors.neutral[600],
            marginBottom: spacing.lg,
            lineHeight: '1.6',
          }}
        >
          Create one credential per role and branch. Everyone in that role signs in with the same login and can work simultaneously. Manage locations under{' '}
          <Link href="/dashboard/branches" style={{ color: colors.primary[700], fontWeight: '600' }}>
            Branches
          </Link>
          .
        </p>
        {credentialsSupported ? (
          <CredentialsSection appCode={app.code} branches={branches} branchesLoading={branchesLoading} />
        ) : (
          <div
            style={{
              padding: spacing.lg,
              backgroundColor: colors.neutral[50],
              border: `1px dashed ${colors.neutral[300]}`,
              borderRadius: '12px',
              color: colors.neutral[600],
              fontSize: '14px',
            }}
          >
            Credential management for this app isn't wired up yet.
          </div>
        )}
      </section>
    </div>
  );
}
