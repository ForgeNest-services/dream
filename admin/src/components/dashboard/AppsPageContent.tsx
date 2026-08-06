'use client';

import { colors, spacing } from '@/lib/design-tokens';
import { AppsGrid } from '@/components/dashboard/AppsGrid';

export function AppsPageContent() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
      <div>
        <h1
          style={{
            fontSize: '28px',
            fontWeight: '700',
            color: colors.neutral[900],
            fontFamily: 'var(--font-playfair)',
            margin: 0,
          }}
        >
          Apps
        </h1>
        <p style={{ fontSize: '14px', color: colors.neutral[600], marginTop: spacing.xs }}>
          Manage staff credentials and open any app you run.
        </p>
      </div>
      <AppsGrid />
    </div>
  );
}
