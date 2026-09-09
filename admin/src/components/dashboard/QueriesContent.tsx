'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { queriesApi } from '@/services/queries-api';
import type { QueryItem } from '@/types/queries';
import { colors, spacing } from '@/lib/design-tokens';
import { Spinner } from '@/components/shared/Spinner';

const APP_LABELS: Record<string, string> = {
  rms: 'Srota RMS',
  ims: 'Srota IMS',
  bundle: 'Both, as a bundle',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-NP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function QueryRow({ item }: { item: QueryItem }) {
  return (
    <div
      style={{
        backgroundColor: colors.neutral[0],
        border: `1px solid ${colors.neutral[200]}`,
        borderRadius: '12px',
        padding: spacing.lg,
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: '15px', fontWeight: 600, color: colors.neutral[900], margin: 0 }}>
            {item.name}
            {item.business_name && (
              <span style={{ fontWeight: 400, color: colors.neutral[500] }}> · {item.business_name}</span>
            )}
          </p>
          <p style={{ fontSize: '13px', color: colors.neutral[600], marginTop: '2px' }}>
            <a href={`mailto:${item.email}`} style={{ color: colors.primary[800] }}>
              {item.email}
            </a>
            {item.phone && <span> · {item.phone}</span>}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: spacing.xs, flexShrink: 0 }}>
          <span style={{ fontSize: '12px', color: colors.neutral[500] }}>{formatDate(item.created_at)}</span>
          {item.app_interest && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: colors.primary[800],
                backgroundColor: colors.primary[50],
                padding: '2px 8px',
                borderRadius: '99px',
              }}
            >
              {APP_LABELS[item.app_interest] ?? item.app_interest}
            </span>
          )}
        </div>
      </div>
      <p style={{ fontSize: '13px', color: colors.neutral[700], marginTop: spacing.md, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
        {item.message}
      </p>
    </div>
  );
}

export function QueriesContent() {
  const [items, setItems] = useState<QueryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await queriesApi.adminList(p, 25);
      if (res.success && res.data) {
        setItems(res.data);
        setTotalPages(res.meta?.total_pages ?? 1);
        setTotal(res.meta?.total ?? res.data.length);
      }
    } catch {
      toast.error('Failed to load queries');
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
          Queries
        </h1>
        <p style={{ fontSize: '14px', color: colors.neutral[600], marginTop: spacing.xs }}>
          Contact form submissions from srotaapps.com — {total} total.
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: spacing['2xl'] }}>
          <Spinner size="lg" />
        </div>
      ) : items.length === 0 ? (
        <div style={{ padding: spacing.xl, color: colors.neutral[500], fontSize: '14px' }}>No queries yet.</div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
            {items.map((item) => (
              <QueryRow key={item.id} item={item} />
            ))}
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
