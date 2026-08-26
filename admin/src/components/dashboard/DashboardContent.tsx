'use client';

import Link from 'next/link';
import {
  MdOutlineApps,
  MdOutlineStore,
  MdArrowForward,
  MdOutlineErrorOutline,
  MdOutlineSchedule,
} from 'react-icons/md';
import { useAuth } from '@/hooks/useAuth';
import { useApps } from '@/hooks/useApps';
import { useBranches } from '@/hooks/useBranches';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { AppSubscription } from '@/types/apps';
import { colors, spacing, radius } from '@/lib/design-tokens';
import { AppsGrid } from '@/components/dashboard/AppsGrid';
import { HospitalityMark } from '@/components/shared/HospitalityMark';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function StatCard({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  href: string;
}) {
  return (
    <Link
      href={href}
      style={{
        flex: 1,
        minWidth: '180px',
        display: 'flex',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.lg,
        backgroundColor: colors.neutral[0],
        border: `1px solid ${colors.neutral[200]}`,
        borderRadius: radius.lg,
        textDecoration: 'none',
        transition: 'border-color 0.15s, transform 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = colors.primary[300];
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = colors.neutral[200];
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div
        style={{
          width: '44px',
          height: '44px',
          borderRadius: radius.md,
          backgroundColor: colors.primary[50],
          color: colors.primary[800],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: '22px', fontWeight: '700', color: colors.neutral[900], margin: 0, lineHeight: 1.1 }}>
          {value}
        </p>
        <p style={{ fontSize: '13px', color: colors.neutral[600], margin: 0, marginTop: '2px' }}>{label}</p>
      </div>
    </Link>
  );
}

function AttentionRow({ appName, appSlug, sub }: { appName: string; appSlug: string; sub: AppSubscription }) {
  const expired = sub.status === 'expired' || (sub.status === 'trialing' && (daysUntil(sub.trial_ends_at) ?? 1) <= 0);
  const days = daysUntil(sub.trial_ends_at);

  return (
    <Link
      href={`/dashboard/apps/${appSlug}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
        padding: spacing.md,
        backgroundColor: expired ? '#FEF2F2' : '#FFFBEB',
        border: `1px solid ${expired ? '#FECACA' : '#FDE68A'}`,
        borderRadius: radius.md,
        textDecoration: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 0 }}>
        {expired ? (
          <MdOutlineErrorOutline size={18} color="#B91C1C" style={{ flexShrink: 0 }} />
        ) : (
          <MdOutlineSchedule size={18} color="#B45309" style={{ flexShrink: 0 }} />
        )}
        <span style={{ fontSize: '14px', fontWeight: '600', color: colors.neutral[900] }}>{appName}</span>
        <span style={{ fontSize: '13px', color: expired ? '#B91C1C' : '#B45309' }}>
          {sub.status === 'expired'
            ? 'Subscription expired'
            : expired
              ? 'Trial expired'
              : `Trial ends in ${days}d`}
        </span>
      </div>
      <MdArrowForward size={16} color={colors.neutral[500]} style={{ flexShrink: 0 }} />
    </Link>
  );
}

export function DashboardContent() {
  const { user, isSuperAdmin, tenant } = useAuth();
  const { apps, isLoading: appsLoading } = useApps();
  const { branches, isLoading: branchesLoading } = useBranches();
  const { subscriptions, loading: subsLoading } = useSubscriptions();

  const firstName =
    user && 'full_name' in user && user.full_name ? user.full_name.split(' ')[0] : user?.email?.split('@')[0];
  const showEmptyState = !isSuperAdmin && tenant && !appsLoading && apps.length === 0;

  const appsInUse = subscriptions.length;
  const needsAttention = subscriptions
    .map((sub) => ({ sub, app: apps.find((a) => a.code === sub.app_code) }))
    .filter(({ sub }) => {
      if (sub.status === 'expired') return true;
      if (sub.status === 'trialing') {
        const days = daysUntil(sub.trial_ends_at);
        return days !== null && days <= 7;
      }
      return false;
    })
    .filter((row): row is { sub: AppSubscription; app: NonNullable<typeof row.app> } => Boolean(row.app));

  const dataReady = !appsLoading && !branchesLoading && !subsLoading;

  return (
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
              : ''}
        </p>
      </div>

      {!isSuperAdmin && tenant && !showEmptyState && dataReady && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.md }}>
          <StatCard
            icon={<MdOutlineApps size={20} />}
            label={appsInUse === 1 ? 'App in use' : 'Apps in use'}
            value={appsInUse}
            href="/dashboard/apps"
          />
          <StatCard
            icon={<MdOutlineStore size={20} />}
            label={branches.length === 1 ? 'Branch' : 'Branches'}
            value={branches.length}
            href="/dashboard/branches"
          />
        </div>
      )}

      {!isSuperAdmin && tenant && needsAttention.length > 0 && (
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
            Needs your attention
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
            {needsAttention.map(({ sub, app }) => (
              <AttentionRow key={sub.id} appName={app.name} appSlug={app.slug} sub={sub} />
            ))}
          </div>
        </section>
      )}

      {!isSuperAdmin && tenant && !showEmptyState && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }}>
            <h2
              style={{
                fontSize: '13px',
                fontWeight: '600',
                color: colors.neutral[500],
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                margin: 0,
              }}
            >
              Your apps
            </h2>
            <Link
              href="/dashboard/apps"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '13px',
                fontWeight: '600',
                color: colors.primary[700],
                textDecoration: 'none',
              }}
            >
              View all
              <MdArrowForward size={14} />
            </Link>
          </div>
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
  );
}
