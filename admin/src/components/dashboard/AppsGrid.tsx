'use client';

import Link from 'next/link';
import { useApps } from '@/hooks/useApps';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { useAuth } from '@/hooks/useAuth';
import { App, AppSubscription } from '@/types/apps';
import { colors, spacing, radius } from '@/lib/design-tokens';
import { Spinner } from '@/components/shared/Spinner';
import {
  MdOutlineHotel,
  MdOutlineRestaurant,
  MdOutlineFitnessCenter,
  MdOutlineInventory2,
  MdOutlinePool,
  MdOutlineApps,
  MdOutlineArrowOutward,
  MdOutlineSettings,
  MdLockOutline,
} from 'react-icons/md';
import { IconType } from 'react-icons';

const WHATSAPP_URL =
  'https://wa.me/9779800000000?text=Hi%2C%20I%27d%20like%20to%20upgrade%20my%20Dream%20subscription.';

const ICON_MAP: Record<string, IconType> = {
  Hotel: MdOutlineHotel,
  Restaurant: MdOutlineRestaurant,
  Fitness: MdOutlineFitnessCenter,
  Inventory: MdOutlineInventory2,
  Pool: MdOutlinePool,
};

const APP_PALETTE = [
  { bg: '#E8EDF2', fg: colors.primary[800] },
  { bg: colors.accent[50], fg: colors.accent[700] },
  { bg: '#EAF6EE', fg: '#1E7A44' },
  { bg: '#F3ECFB', fg: '#6D3FBF' },
];

function paletteFor(code: string) {
  let hash = 0;
  for (let i = 0; i < code.length; i++) hash = (hash * 31 + code.charCodeAt(i)) >>> 0;
  return APP_PALETTE[hash % APP_PALETTE.length];
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function isAccessible(sub: AppSubscription | null): boolean {
  if (!sub) return false;
  if (sub.status === 'trialing') {
    const days = daysUntil(sub.trial_ends_at);
    return days !== null && days > 0;
  }
  return sub.status === 'active';
}

function SubBadge({ sub }: { sub: AppSubscription | null }) {
  if (!sub) return null;

  if (sub.status === 'trialing') {
    const days = daysUntil(sub.trial_ends_at);
    if (days === null || days <= 0) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: '600', color: '#B45309', backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', padding: '2px 7px', borderRadius: radius.full }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#D97706', flexShrink: 0 }} />
          Trial expired
        </span>
      );
    }
    const urgent = days <= 7;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: '600', color: urgent ? '#B45309' : colors.primary[700], backgroundColor: urgent ? '#FEF3C7' : colors.primary[50], border: `1px solid ${urgent ? '#FDE68A' : colors.primary[200]}`, padding: '2px 7px', borderRadius: radius.full }}>
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: urgent ? '#D97706' : colors.primary[500], flexShrink: 0 }} />
        Trial · {days}d
      </span>
    );
  }

  if (sub.status === 'active') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: '600', color: '#15803D', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', padding: '2px 7px', borderRadius: radius.full }}>
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#22C55E', flexShrink: 0 }} />
        Active
      </span>
    );
  }

  if (sub.status === 'expired') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: '600', color: '#B91C1C', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', padding: '2px 7px', borderRadius: radius.full }}>
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#EF4444', flexShrink: 0 }} />
        Expired
      </span>
    );
  }

  return null;
}

function MyAppTile({ app, sub }: { app: App; sub: AppSubscription | null }) {
  const Icon = (app.icon && ICON_MAP[app.icon]) || MdOutlineApps;
  const palette = paletteFor(app.code);
  const accessible = isAccessible(sub);

  return (
    <div
      style={{
        backgroundColor: colors.neutral[0],
        border: `1px solid ${colors.primary[200]}`,
        borderRadius: radius.lg,
        padding: spacing.lg,
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.lg,
        transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = colors.primary[300];
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(10, 41, 71, 0.08)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = colors.primary[200];
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md }}>
        <div
          style={{
            width: '52px',
            height: '52px',
            borderRadius: radius.md,
            backgroundColor: palette.bg,
            color: palette.fg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {app.icon_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={app.icon_url} alt={`${app.name} logo`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <Icon size={26} />
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px', flexShrink: 0 }}>
          <span
            style={{
              fontSize: '10px',
              fontWeight: '700',
              color: colors.primary[700],
              backgroundColor: colors.primary[50],
              border: `1px solid ${colors.primary[200]}`,
              padding: '3px 8px',
              borderRadius: radius.full,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            My App
          </span>
          <SubBadge sub={sub} />
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <h3
          style={{
            fontSize: '17px',
            fontWeight: '700',
            color: colors.neutral[900],
            margin: 0,
            fontFamily: 'var(--font-playfair)',
          }}
        >
          {app.name}
        </h3>
        {app.description && (
          <p
            style={{
              fontSize: '13px',
              color: colors.neutral[600],
              lineHeight: '1.55',
              margin: 0,
              marginTop: spacing.xs,
            }}
          >
            {app.description}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: spacing.sm }}>
        <Link
          href={`/dashboard/apps/${app.slug}`}
          style={{
            flex: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.xs,
            padding: `${spacing.sm} ${spacing.md}`,
            borderRadius: radius.full,
            border: `1px solid ${colors.neutral[300]}`,
            backgroundColor: colors.neutral[0],
            color: colors.neutral[800],
            fontSize: '13px',
            fontWeight: '600',
            textDecoration: 'none',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.neutral[50])}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = colors.neutral[0])}
        >
          <MdOutlineSettings size={15} />
          Manage
        </Link>
        {accessible ? (
          <a
            href={app.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xs,
              padding: `${spacing.sm} ${spacing.md}`,
              borderRadius: radius.full,
              border: `1px solid ${colors.primary[800]}`,
              backgroundColor: colors.primary[800],
              color: colors.neutral[0],
              fontSize: '13px',
              fontWeight: '600',
              textDecoration: 'none',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.primary[700])}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = colors.primary[800])}
          >
            Open
            <MdOutlineArrowOutward size={15} />
          </a>
        ) : (
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xs,
              padding: `${spacing.sm} ${spacing.md}`,
              borderRadius: radius.full,
              border: '1px solid #16A34A',
              backgroundColor: '#16A34A',
              color: '#fff',
              fontSize: '13px',
              fontWeight: '600',
              textDecoration: 'none',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#15803D')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#16A34A')}
          >
            Upgrade
            <MdOutlineArrowOutward size={15} />
          </a>
        )}
      </div>
    </div>
  );
}

function LockedAppTile({ app }: { app: App }) {
  const Icon = (app.icon && ICON_MAP[app.icon]) || MdOutlineApps;

  return (
    <div
      style={{
        backgroundColor: colors.neutral[50],
        border: `1px solid ${colors.neutral[200]}`,
        borderRadius: radius.lg,
        padding: spacing.lg,
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.lg,
        opacity: 0.72,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md }}>
        <div
          style={{
            width: '52px',
            height: '52px',
            borderRadius: radius.md,
            backgroundColor: colors.neutral[200],
            color: colors.neutral[500],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {app.icon_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={app.icon_url} alt={`${app.name} logo`} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'grayscale(1)' }} />
          ) : (
            <Icon size={26} />
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <MdLockOutline size={13} color={colors.neutral[400]} />
          <span
            style={{
              fontSize: '10px',
              fontWeight: '700',
              color: colors.neutral[500],
              backgroundColor: colors.neutral[100],
              border: `1px solid ${colors.neutral[200]}`,
              padding: '3px 8px',
              borderRadius: radius.full,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Locked
          </span>
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <h3
          style={{
            fontSize: '17px',
            fontWeight: '700',
            color: colors.neutral[600],
            margin: 0,
            fontFamily: 'var(--font-playfair)',
          }}
        >
          {app.name}
        </h3>
        {app.description && (
          <p
            style={{
              fontSize: '13px',
              color: colors.neutral[500],
              lineHeight: '1.55',
              margin: 0,
              marginTop: spacing.xs,
            }}
          >
            {app.description}
          </p>
        )}
      </div>

      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
          padding: `${spacing.sm} ${spacing.md}`,
          borderRadius: radius.full,
          border: '1px solid #BBF7D0',
          backgroundColor: colors.neutral[0],
          color: '#16A34A',
          fontSize: '13px',
          fontWeight: '600',
          textDecoration: 'none',
          transition: 'background-color 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F0FDF4')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = colors.neutral[0])}
      >
        Upgrade via WhatsApp
        <MdOutlineArrowOutward size={15} />
      </a>
    </div>
  );
}

export function AppsGrid() {
  const { apps, isLoading, error } = useApps();
  const { forApp } = useSubscriptions();
  const { tenant } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: spacing['2xl'] }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: spacing.lg,
          backgroundColor: `${colors.status.error}10`,
          border: `1px solid ${colors.status.error}30`,
          borderRadius: radius.md,
          color: colors.status.error,
          fontSize: '14px',
        }}
      >
        Couldn't load apps: {error.message}
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <div style={{ padding: spacing['2xl'], textAlign: 'center', color: colors.neutral[500], fontSize: '14px' }}>
        No apps available yet.
      </div>
    );
  }

  const freeAppCode = tenant?.free_app_code;
  const myApp = freeAppCode ? apps.find((a) => a.code === freeAppCode) ?? null : null;
  const otherApps = freeAppCode ? apps.filter((a) => a.code !== freeAppCode) : apps;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2xl'] }}>
      {myApp && (
        <div>
          <p style={{ fontSize: '12px', fontWeight: '700', color: colors.primary[600], textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0, marginBottom: spacing.lg }}>
            Your active app
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: spacing.lg }}>
            <MyAppTile app={myApp} sub={forApp(myApp.code)} />
          </div>
        </div>
      )}

      {otherApps.length > 0 && (
        <div>
          <p style={{ fontSize: '12px', fontWeight: '700', color: colors.neutral[400], textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0, marginBottom: spacing.lg }}>
            {myApp ? 'Other apps — contact us to unlock' : 'Available apps'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: spacing.lg }}>
            {otherApps.map((app) => (
              <LockedAppTile key={app.id} app={app} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
