'use client';

import Link from 'next/link';
import { useApps } from '@/hooks/useApps';
import { App } from '@/types/apps';
import { colors, spacing } from '@/lib/design-tokens';
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

function AppTile({ app }: { app: App }) {
  const Icon = (app.icon && ICON_MAP[app.icon]) || MdOutlineApps;

  return (
    <div
      style={{
        backgroundColor: colors.neutral[0],
        border: `1px solid ${colors.neutral[200]}`,
        borderRadius: '16px',
        padding: spacing.xl,
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.lg,
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = colors.primary[800];
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(10, 41, 71, 0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = colors.neutral[200];
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: colors.primary[50],
            color: colors.primary[800],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={24} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              fontSize: '18px',
              fontWeight: '600',
              color: colors.neutral[900],
              margin: 0,
            }}
          >
            {app.name}
          </h3>
          <p
            style={{
              fontSize: '12px',
              color: colors.neutral[500],
              margin: 0,
              marginTop: '2px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            {app.code}
          </p>
        </div>
      </div>

      {app.description && (
        <p
          style={{
            fontSize: '14px',
            color: colors.neutral[600],
            lineHeight: '1.5',
            margin: 0,
            flex: 1,
          }}
        >
          {app.description}
        </p>
      )}

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
            borderRadius: '24px',
            border: `1px solid ${colors.neutral[300]}`,
            backgroundColor: colors.neutral[0],
            color: colors.neutral[800],
            fontSize: '14px',
            fontWeight: '600',
            textDecoration: 'none',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.neutral[50];
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = colors.neutral[0];
          }}
        >
          <MdOutlineSettings size={16} />
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
            borderRadius: '24px',
            border: `1px solid ${colors.primary[800]}`,
            backgroundColor: colors.primary[800],
            color: colors.neutral[0],
            fontSize: '14px',
            fontWeight: '600',
            textDecoration: 'none',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.primary[700];
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = colors.primary[800];
          }}
        >
          Open
          <MdOutlineArrowOutward size={16} />
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
          borderRadius: '12px',
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
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: spacing.xl,
      }}
    >
      {apps.map((app) => (
        <AppTile key={app.id} app={app} />
      ))}
    </div>
  );
}
