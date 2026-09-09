'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { subscribersApi } from '@/services/subscribers-api';
import type { SubscriberItem } from '@/types/subscribers';
import { colors, spacing } from '@/lib/design-tokens';
import { Spinner } from '@/components/shared/Spinner';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-NP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SubscribersContent() {
  const [items, setItems] = useState<SubscriberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await subscribersApi.adminList(p, 25);
      if (res.success && res.data) {
        setItems(res.data);
        setTotalPages(res.meta?.total_pages ?? 1);
        setTotal(res.meta?.total ?? res.data.length);
      }
    } catch {
      toast.error('Failed to load subscribers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page);
  }, [load, page]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2xl'] }}>
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: colors.neutral[900], fontFamily: 'var(--font-playfair)', margin: 0 }}>
          Subscribers
        </h1>
        <p style={{ fontSize: '14px', color: colors.neutral[600], marginTop: spacing.xs }}>
          Newsletter signups from srotaapps.com — {total} total.
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: spacing['2xl'] }}>
          <Spinner size="lg" />
        </div>
      ) : items.length === 0 ? (
        <div style={{ padding: spacing.xl, color: colors.neutral[500], fontSize: '14px' }}>No subscribers yet.</div>
      ) : (
        <>
          <div
            style={{
              backgroundColor: colors.neutral[0],
              border: `1px solid ${colors.neutral[200]}`,
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: colors.neutral[50] }}>
                  <th style={{ textAlign: 'left', padding: `${spacing.sm} ${spacing.lg}`, color: colors.neutral[500], fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Email
                  </th>
                  <th style={{ textAlign: 'right', padding: `${spacing.sm} ${spacing.lg}`, color: colors.neutral[500], fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Subscribed
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={{ borderTop: `1px solid ${colors.neutral[100]}` }}>
                    <td style={{ padding: `${spacing.sm} ${spacing.lg}` }}>
                      <a href={`mailto:${item.email}`} style={{ color: colors.primary[800] }}>
                        {item.email}
                      </a>
                    </td>
                    <td style={{ padding: `${spacing.sm} ${spacing.lg}`, textAlign: 'right', color: colors.neutral[600] }}>
                      {formatDate(item.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{
                  padding: `${spacing.sm} ${spacing.md}`,
                  borderRadius: '8px',
                  border: `1px solid ${colors.neutral[200]}`,
                  backgroundColor: colors.neutral[0],
                  fontSize: '13px',
                  fontWeight: 600,
                  color: colors.neutral[700],
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  opacity: page <= 1 ? 0.5 : 1,
                }}
              >
                Previous
              </button>
              <span style={{ fontSize: '13px', color: colors.neutral[600] }}>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{
                  padding: `${spacing.sm} ${spacing.md}`,
                  borderRadius: '8px',
                  border: `1px solid ${colors.neutral[200]}`,
                  backgroundColor: colors.neutral[0],
                  fontSize: '13px',
                  fontWeight: 600,
                  color: colors.neutral[700],
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: page >= totalPages ? 0.5 : 1,
                }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
