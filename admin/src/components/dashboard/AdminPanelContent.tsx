'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { appsApi } from '@/services/apps-api';
import type { SubscriptionPlan, AdminSubscription, AdminPayment } from '@/types/apps';
import { colors, spacing, radius } from '@/lib/design-tokens';
import { Spinner } from '@/components/shared/Spinner';

// ── helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-NP', { year: 'numeric', month: 'short', day: 'numeric' });
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  trialing:  { bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6' },
  active:    { bg: '#F0FDF4', text: '#15803D', dot: '#22C55E' },
  expired:   { bg: '#FEF2F2', text: '#B91C1C', dot: '#EF4444' },
  cancelled: { bg: '#F9FAFB', text: '#6B7280', dot: '#9CA3AF' },
  pending:   { bg: '#FFFBEB', text: '#B45309', dot: '#F59E0B' },
  confirmed: { bg: '#F0FDF4', text: '#15803D', dot: '#22C55E' },
  rejected:  { bg: '#FEF2F2', text: '#B91C1C', dot: '#EF4444' },
};

function StatusPill({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? { bg: '#F3F4F6', text: '#374151', dot: '#9CA3AF' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: c.text, backgroundColor: c.bg, padding: '2px 8px', borderRadius: '99px' }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: c.dot, flexShrink: 0 }} />
      {status}
    </span>
  );
}

const APP_LABELS: Record<string, string> = {
  srota_pms: 'Srota PMS',
  srota_rms: 'Srota RMS',
  srota_ims: 'Srota IMS',
  bundle: 'Bundle (All Apps)',
};

// ── Plans tab ────────────────────────────────────────────────────────────────

const APP_DESCRIPTIONS: Record<string, string> = {
  srota_pms: 'Hotel property management — rooms, bookings, folios',
  srota_rms: 'Restaurant POS — orders, kitchen, menu management',
  srota_ims: 'Inventory management — stock, suppliers, movements',
  bundle: 'All apps at a discounted combined rate',
};

function PricingCard({
  plan,
  savings,
  isEditing,
  editPrice,
  saving,
  onEdit,
  onSave,
  onCancel,
  onEditPriceChange,
}: {
  plan: SubscriptionPlan;
  savings: number | null;
  isEditing: boolean;
  editPrice: string;
  saving: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onEditPriceChange: (v: string) => void;
}) {
  const isYearly = plan.plan === 'yearly';
  const perMonth = isYearly ? Math.round(Number(plan.price_npr) / 12) : null;
  const hasSavings = isYearly && savings !== null && savings > 0;

  return (
    <div style={{
      borderRadius: '16px',
      border: `1.5px solid ${isYearly ? colors.primary[200] : colors.neutral[200]}`,
      backgroundColor: isYearly ? colors.primary[50] : colors.neutral[0],
      padding: spacing.xl,
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Best value ribbon */}
      {hasSavings && (
        <div style={{
          position: 'absolute', top: 0, right: 0,
          backgroundColor: '#16A34A', color: '#fff',
          fontSize: '9px', fontWeight: 800,
          padding: '4px 12px',
          borderBottomLeftRadius: '10px',
          letterSpacing: '0.6px',
        }}>
          BEST VALUE
        </div>
      )}

      {/* Period label */}
      <div style={{
        fontSize: '10px', fontWeight: 800,
        color: isYearly ? colors.primary[600] : colors.neutral[400],
        textTransform: 'uppercase', letterSpacing: '1.2px',
        marginBottom: spacing.md,
      }}>
        {plan.plan === 'monthly' ? 'Monthly' : 'Annual'}
      </div>

      {isEditing ? (
        /* ── Edit mode ── */
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: spacing.lg }}>
            <span style={{ fontSize: '16px', fontWeight: 700, color: colors.neutral[500] }}>Rs.</span>
            <input
              type="number"
              value={editPrice}
              onChange={(e) => onEditPriceChange(e.target.value)}
              style={{
                width: '120px',
                border: `2px solid ${colors.primary[400]}`,
                borderRadius: radius.sm,
                padding: '6px 10px',
                fontSize: '28px', fontWeight: 800,
                color: colors.neutral[900],
                outline: 'none',
                background: 'transparent',
              }}
              autoFocus
            />
          </div>
          <div style={{ display: 'flex', gap: spacing.sm }}>
            <button
              onClick={onSave}
              disabled={saving}
              style={{
                flex: 1, fontSize: '13px', fontWeight: 700, color: '#fff',
                backgroundColor: colors.primary[800], border: 'none',
                borderRadius: radius.sm, padding: '9px',
                cursor: saving ? 'default' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Save price'}
            </button>
            <button
              onClick={onCancel}
              style={{
                fontSize: '13px', color: colors.neutral[600],
                backgroundColor: colors.neutral[100], border: 'none',
                borderRadius: radius.sm, padding: '9px 14px', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        /* ── View mode ── */
        <>
          {/* Price display */}
          <div style={{ marginBottom: '4px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: isYearly ? colors.primary[500] : colors.neutral[400] }}>Rs. </span>
            <span style={{
              fontSize: '36px', fontWeight: 800,
              color: isYearly ? colors.primary[800] : colors.neutral[900],
              letterSpacing: '-1px', lineHeight: 1,
            }}>
              {Number(plan.price_npr).toLocaleString()}
            </span>
          </div>

          {/* Billing note */}
          <div style={{ fontSize: '12px', color: isYearly ? colors.primary[500] : colors.neutral[400], marginBottom: spacing.md }}>
            {perMonth ? `Rs. ${perMonth.toLocaleString()}/mo · billed yearly` : 'billed monthly'}
          </div>

          {/* Savings badge */}
          {hasSavings ? (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              fontSize: '11px', fontWeight: 700, color: '#15803D',
              backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0',
              borderRadius: radius.full, padding: '3px 10px',
              marginBottom: spacing.lg, alignSelf: 'flex-start',
            }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 5.5L3.5 7.5L8.5 2.5" stroke="#15803D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Save Rs. {savings!.toLocaleString()}
            </div>
          ) : (
            <div style={{ marginBottom: spacing.lg }} />
          )}

          {/* Divider */}
          <div style={{ height: '1px', backgroundColor: isYearly ? colors.primary[100] : colors.neutral[100], marginBottom: spacing.md }} />

          {/* Plan label from DB */}
          <div style={{ fontSize: '11px', color: isYearly ? colors.primary[500] : colors.neutral[400], marginBottom: spacing.md, flex: 1 }}>
            {plan.label}
          </div>

          {/* Edit button */}
          <button
            onClick={onEdit}
            style={{
              alignSelf: 'flex-start',
              fontSize: '12px', fontWeight: 700,
              color: colors.primary[700],
              backgroundColor: 'transparent',
              border: `1.5px solid ${isYearly ? colors.primary[300] : colors.neutral[300]}`,
              borderRadius: radius.full,
              padding: '5px 16px',
              cursor: 'pointer',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.primary[50])}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            Edit price
          </button>
        </>
      )}
    </div>
  );
}

function PlansTab() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await appsApi.adminListPlans();
      if (res.success && res.data) setPlans(res.data);
    } catch { toast.error('Failed to load plans'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = (p: SubscriptionPlan) => { setEditId(p.id); setEditPrice(p.price_npr); };

  const saveEdit = async (p: SubscriptionPlan) => {
    const price = parseFloat(editPrice);
    if (isNaN(price) || price <= 0) { toast.error('Enter a valid price'); return; }
    setSaving(true);
    try {
      const res = await appsApi.adminUpdatePlan(p.id, { price_npr: price });
      if (res.success) { toast.success('Price updated'); setEditId(null); await load(); }
    } catch { toast.error('Failed to update price'); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: spacing['2xl'] }}><Spinner size="lg" /></div>;

  const grouped = plans.reduce<Record<string, SubscriptionPlan[]>>((acc, p) => {
    if (!acc[p.app_code]) acc[p.app_code] = [];
    acc[p.app_code].push(p);
    return acc;
  }, {});

  const appOrder = ['srota_pms', 'srota_rms', 'srota_ims', 'bundle'];
  const sortedApps = [...Object.keys(grouped)].sort((a, b) => appOrder.indexOf(a) - appOrder.indexOf(b));

  return (
    <div>
      <p style={{ fontSize: '13px', color: colors.neutral[500], marginTop: 0, marginBottom: spacing['2xl'] }}>
        Prices tenants see when they pick a plan. Changes take effect immediately for new payment requests.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
        {sortedApps.map((appCode) => {
          const appPlans = [...grouped[appCode]].sort((a, b) => a.plan === 'monthly' ? -1 : 1);
          const monthlyPlan = appPlans.find((x) => x.plan === 'monthly');

          return (
            <div key={appCode}>
              {/* Section header */}
              <div style={{ marginBottom: spacing.lg, paddingBottom: spacing.md, borderBottom: `1px solid ${colors.neutral[100]}` }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: colors.neutral[900] }}>
                  {APP_LABELS[appCode] ?? appCode}
                </h3>
                <p style={{ margin: `${spacing.xs} 0 0`, fontSize: '12px', color: colors.neutral[400] }}>
                  {APP_DESCRIPTIONS[appCode] ?? ''}
                </p>
              </div>

              {/* Pricing cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: spacing.lg, maxWidth: '540px' }}>
                {appPlans.map((p) => {
                  const savings = p.plan === 'yearly' && monthlyPlan
                    ? Math.round(Number(monthlyPlan.price_npr) * 12 - Number(p.price_npr))
                    : null;
                  return (
                    <PricingCard
                      key={p.id}
                      plan={p}
                      savings={savings}
                      isEditing={editId === p.id}
                      editPrice={editPrice}
                      saving={saving}
                      onEdit={() => startEdit(p)}
                      onSave={() => saveEdit(p)}
                      onCancel={() => setEditId(null)}
                      onEditPriceChange={setEditPrice}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Payments tab ─────────────────────────────────────────────────────────────

function PaymentsTab() {
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await appsApi.adminListAllPayments();
      if (res.success && res.data) setPayments(res.data);
    } catch { toast.error('Failed to load payments'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const confirm = async (id: string) => {
    setBusy(id);
    try {
      const res = await appsApi.adminConfirmPayment(id);
      if (res.success) { toast.success('Payment confirmed, subscription activated'); await load(); }
      else toast.error('Failed to confirm');
    } catch { toast.error('Failed to confirm'); }
    finally { setBusy(null); }
  };

  const reject = async (id: string) => {
    setBusy(id);
    try {
      const res = await appsApi.adminRejectPayment(id);
      if (res.success) { toast.success('Payment rejected'); await load(); }
      else toast.error('Failed to reject');
    } catch { toast.error('Failed to reject'); }
    finally { setBusy(null); }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: spacing['2xl'] }}><Spinner size="lg" /></div>;
  if (!payments.length) return <div style={{ padding: spacing.xl, color: colors.neutral[500], fontSize: '14px' }}>No payment requests yet.</div>;

  const pending = payments.filter((p) => p.status === 'pending');
  const rest = payments.filter((p) => p.status !== 'pending');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
      {pending.length > 0 && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: colors.neutral[500], textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: spacing.sm }}>
            Pending ({pending.length})
          </div>
          <PaymentTable rows={pending} onConfirm={confirm} onReject={reject} busy={busy} />
        </div>
      )}
      {rest.length > 0 && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: colors.neutral[500], textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: spacing.sm }}>
            History
          </div>
          <PaymentTable rows={rest} busy={busy} />
        </div>
      )}
    </div>
  );
}

function PaymentTable({
  rows,
  onConfirm,
  onReject,
  busy,
}: {
  rows: AdminPayment[];
  onConfirm?: (id: string) => void;
  onReject?: (id: string) => void;
  busy: string | null;
}) {
  return (
    <div style={{ backgroundColor: colors.neutral[0], border: `1px solid ${colors.neutral[200]}`, borderRadius: '12px', overflow: 'hidden', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '720px' }}>
        <thead>
          <tr style={{ backgroundColor: colors.neutral[50] }}>
            {['Tenant', 'App', 'Plan', 'Amount', 'Method', 'Notes', 'Submitted', 'Status', ''].map((h) => (
              <th key={h} style={{ padding: `${spacing.sm} ${spacing.md}`, textAlign: 'left', fontSize: '11px', fontWeight: 700, color: colors.neutral[500], textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `1px solid ${colors.neutral[100]}`, whiteSpace: 'nowrap' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr
              key={p.id}
              style={{ borderBottom: `1px solid ${colors.neutral[50]}`, transition: 'background-color 0.1s' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.neutral[50])}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <td style={{ padding: `${spacing.sm} ${spacing.md}`, fontWeight: 600, color: colors.neutral[800], whiteSpace: 'nowrap' }}>{p.tenant_name}</td>
              <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.neutral[600], whiteSpace: 'nowrap' }}>{APP_LABELS[p.app_code] ?? p.app_code}</td>
              <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.neutral[600], textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{p.plan}</td>
              <td style={{ padding: `${spacing.sm} ${spacing.md}`, fontWeight: 600, whiteSpace: 'nowrap' }}>Rs. {Number(p.amount_npr).toLocaleString()}</td>
              <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.neutral[500], whiteSpace: 'nowrap' }}>{p.payment_method ?? '—'}</td>
              <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.neutral[500], maxWidth: '160px' }}>
                {p.notes ? (
                  <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.notes}>{p.notes}</span>
                ) : '—'}
              </td>
              <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.neutral[500], whiteSpace: 'nowrap' }}>{formatDate(p.created_at)}</td>
              <td style={{ padding: `${spacing.sm} ${spacing.md}` }}><StatusPill status={p.status} /></td>
              <td style={{ padding: `${spacing.sm} ${spacing.md}` }}>
                {p.status === 'pending' && onConfirm && onReject && (
                  <div style={{ display: 'flex', gap: spacing.xs }}>
                    <button
                      onClick={() => onConfirm(p.id)}
                      disabled={busy === p.id}
                      style={{ fontSize: '12px', fontWeight: 600, color: '#fff', backgroundColor: '#16A34A', border: 'none', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', opacity: busy === p.id ? 0.6 : 1, whiteSpace: 'nowrap' }}
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => onReject(p.id)}
                      disabled={busy === p.id}
                      style={{ fontSize: '12px', fontWeight: 600, color: '#B91C1C', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', opacity: busy === p.id ? 0.6 : 1, whiteSpace: 'nowrap' }}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Subscriptions tab ────────────────────────────────────────────────────────

function SubscriptionsTab() {
  const [subs, setSubs] = useState<AdminSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await appsApi.adminListAllSubscriptions();
      if (res.success && res.data) setSubs(res.data);
    } catch { toast.error('Failed to load subscriptions'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const extendTrial = async (sub: AdminSubscription) => {
    setBusy(sub.id);
    try {
      const res = await appsApi.adminExtendTrial(sub.tenant_id, sub.app_code, 30);
      if (res.success) { toast.success('Trial extended by 30 days'); await load(); }
      else toast.error('Failed to extend trial');
    } catch { toast.error('Failed to extend trial'); }
    finally { setBusy(null); }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: spacing['2xl'] }}><Spinner size="lg" /></div>;
  if (!subs.length) return <div style={{ padding: spacing.xl, color: colors.neutral[500], fontSize: '14px' }}>No subscriptions yet.</div>;

  return (
    <div style={{ backgroundColor: colors.neutral[0], border: `1px solid ${colors.neutral[200]}`, borderRadius: '12px', overflow: 'hidden', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '600px' }}>
        <thead>
          <tr style={{ backgroundColor: colors.neutral[50] }}>
            {['Tenant', 'App', 'Status', 'Plan', 'Ends / Expires', 'Actions'].map((h) => (
              <th key={h} style={{ padding: `${spacing.sm} ${spacing.md}`, textAlign: 'left', fontSize: '11px', fontWeight: 700, color: colors.neutral[500], textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `1px solid ${colors.neutral[100]}`, whiteSpace: 'nowrap' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {subs.map((s) => {
            const endDate = s.status === 'trialing' ? s.trial_ends_at : s.period_end;
            const days = daysUntil(endDate);
            return (
              <tr
                key={s.id}
                style={{ borderBottom: `1px solid ${colors.neutral[50]}`, transition: 'background-color 0.1s' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.neutral[50])}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <td style={{ padding: `${spacing.sm} ${spacing.md}` }}>
                  <div style={{ fontWeight: 600, color: colors.neutral[800] }}>{s.tenant_name}</div>
                  {s.tenant_email && <div style={{ fontSize: '11px', color: colors.neutral[400] }}>{s.tenant_email}</div>}
                </td>
                <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.neutral[600] }}>{APP_LABELS[s.app_code] ?? s.app_code}</td>
                <td style={{ padding: `${spacing.sm} ${spacing.md}` }}><StatusPill status={s.status} /></td>
                <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.neutral[600], textTransform: 'capitalize' }}>{s.plan ?? '—'}</td>
                <td style={{ padding: `${spacing.sm} ${spacing.md}`, color: colors.neutral[500] }}>
                  {endDate ? (
                    <span>
                      {formatDate(endDate)}
                      {days !== null && days > 0 && <span style={{ marginLeft: '4px', fontSize: '11px', color: days <= 7 ? '#D97706' : colors.neutral[400] }}>({days}d)</span>}
                    </span>
                  ) : '—'}
                </td>
                <td style={{ padding: `${spacing.sm} ${spacing.md}` }}>
                  {(s.status === 'trialing' || s.status === 'expired') && (
                    <button
                      onClick={() => extendTrial(s)}
                      disabled={busy === s.id}
                      style={{ fontSize: '11px', fontWeight: 600, color: colors.primary[800], backgroundColor: colors.primary[50], border: `1px solid ${colors.primary[200]}`, borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', opacity: busy === s.id ? 0.6 : 1 }}
                    >
                      +30d trial
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'plans', label: 'Pricing Plans' },
  { id: 'payments', label: 'Payment Requests' },
  { id: 'subscriptions', label: 'All Subscriptions' },
] as const;

type Tab = (typeof TABS)[number]['id'];

export function AdminPanelContent() {
  const [tab, setTab] = useState<Tab>('plans');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2xl'] }}>
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: colors.neutral[900], fontFamily: 'var(--font-playfair)', margin: 0 }}>
          Admin Panel
        </h1>
        <p style={{ fontSize: '14px', color: colors.neutral[600], marginTop: spacing.xs }}>
          Manage subscription plans, confirm payments, and view all tenant subscriptions.
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '2px', backgroundColor: colors.neutral[100], padding: '3px', borderRadius: '10px', width: 'fit-content' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: `${spacing.sm} ${spacing.lg}`,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              backgroundColor: tab === t.id ? colors.neutral[0] : 'transparent',
              color: tab === t.id ? colors.neutral[900] : colors.neutral[500],
              boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'plans' && <PlansTab />}
      {tab === 'payments' && <PaymentsTab />}
      {tab === 'subscriptions' && <SubscriptionsTab />}
    </div>
  );
}
