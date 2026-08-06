'use client';

import Link from 'next/link';
import { useApps } from '@/hooks/useApps';
import { App } from '@/types/apps';
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
} from 'react-icons/md';
import { IconType } from 'react-icons';

const ICON_MAP: Record<string, IconType> = {
  Hotel: MdOutlineHotel,
  Restaurant: MdOutlineRestaurant,
  Fitness: MdOutlineFitnessCenter,
  Inventory: MdOutlineInventory2,
  Pool: MdOutlinePool,
};

// Each app gets a stable identity color, cycled deterministically from its
// code — reads as "distinct products," not one uniform navy-tinted set.
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

function AppTile({ app }: { app: App }) {
  const Icon = (app.icon && ICON_MAP[app.icon]) || MdOutlineApps;
  const palette = paletteFor(app.code);

  return (
    <div
      style={{
        backgroundColor: colors.neutral[0],
        border: `1px solid ${colors.neutral[200]}`,
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
        e.currentTarget.style.borderColor = colors.neutral[200];
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
          }}
        >
          <Icon size={26} />
        </div>
        <span
          style={{
            fontSize: '10px',
            fontWeight: '700',
            color: colors.neutral[500],
            backgroundColor: colors.neutral[50],
            border: `1px solid ${colors.neutral[200]}`,
            padding: '3px 8px',
            borderRadius: radius.full,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            flexShrink: 0,
          }}
        >
          {app.code.replace(/_/g, ' ')}
        </span>
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
      </div>
    </div>
  );
}

export function AppsGrid() {
  const { apps, isLoading, error } = useApps();

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
      <div
        style={{
          padding: spacing['2xl'],
          textAlign: 'center',
          color: colors.neutral[500],
          fontSize: '14px',
        }}
      >
        No apps available yet.
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: spacing.lg,
      }}
    >
      {apps.map((app) => (
        <AppTile key={app.id} app={app} />
      ))}
    </div>
  );
}
