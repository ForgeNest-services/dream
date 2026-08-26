'use client';

import { useState, useEffect, useMemo } from 'react';
import type { App, AppSubscription, PriceQuote, SubmitPaymentPayload } from '@/types/apps';
import { colors, spacing, radius } from '@/lib/design-tokens';

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-NP', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ sub }: { sub: AppSubscription | null }) {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    borderRadius: radius.full,
    padding: '5px 14px',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.1px',
  };
  const dot: React.CSSProperties = { width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 };

  if (!sub) {
    return (
      <span style={{ ...base, backgroundColor: colors.neutral[100], color: colors.neutral[500] }}>
        <span style={{ ...dot, backgroundColor: colors.neutral[400] }} />
        No subscription
      </span>
    );
  }

  if (sub.status === 'trialing') {
    const days = daysUntil(sub.trial_ends_at);
    const urgent = days !== null && days <= 7;
    return (
      <span style={{ ...base, backgroundColor: urgent ? '#FEF3C7' : colors.primary[50], color: urgent ? '#B45309' : colors.primary[700] }}>
        <span style={{ ...dot, backgroundColor: urgent ? '#D97706' : colors.primary[500] }} />
        {days !== null && days > 0 ? `Trial · ${days}d left` : 'Trial expired'}
      </span>
    );
  }

  if (sub.status === 'active') {
    const days = daysUntil(sub.period_end);
    return (
      <span style={{ ...base, backgroundColor: '#F0FDF4', color: '#15803D' }}>
        <span style={{ ...dot, backgroundColor: '#22C55E' }} />
        Active{days !== null && days > 0 ? ` · ${days}d left` : ' · expiring soon'}
      </span>
    );
  }

  if (sub.status === 'expired') {
    return (
      <span style={{ ...base, backgroundColor: '#FEF2F2', color: '#B91C1C' }}>
        <span style={{ ...dot, backgroundColor: '#EF4444' }} />
        Expired
      </span>
    );
  }

  return (
    <span style={{ ...base, backgroundColor: colors.neutral[100], color: colors.neutral[500] }}>
      <span style={{ ...dot, backgroundColor: colors.neutral[400] }} />
      {sub.status}
    </span>
  );
}

// ── Plan card ─────────────────────────────────────────────────────────────────
// Priced from the live quote (SubscriptionService.price_selection), not a
// single app's static SubscriptionPlan.price_npr — with 2+ apps selected
// this is the discounted bundle total, computed server-side.

function PlanCard({
  period,
  price,
  perMonth,
  disabled,
  active,
  savings,
  onSelect,
}: {
  period: 'monthly' | 'yearly';
  price: number | null;
  perMonth: number | null;
  disabled: boolean;
  active: boolean;
  savings: number | null;
  onSelect: () => void;
}) {
  const isYearly = period === 'yearly';
  const hasBestValue = isYearly && savings !== null && savings > 0;

  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      style={{
        borderRadius: '14px',
        border: `2px solid ${active ? colors.primary[800] : colors.neutral[200]}`,
        backgroundColor: active ? colors.primary[800] : colors.neutral[0],
        padding: '20px 18px 18px',
        textAlign: 'left',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'all 0.18s',
        position: 'relative',
        overflow: 'hidden',
        outline: 'none',
        boxShadow: active ? '0 8px 24px rgba(10,41,71,0.18)' : 'none',
      }}
      onMouseEnter={(e) => {
        if (!active && !disabled) {
          e.currentTarget.style.borderColor = colors.primary[300];
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(10,41,71,0.08)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = colors.neutral[200];
          e.currentTarget.style.boxShadow = 'none';
        }
      }}
    >
      {/* Best value ribbon */}
      {hasBestValue && (
        <div style={{
          position: 'absolute', top: 0, right: 0,
          backgroundColor: active ? 'rgba(255,255,255,0.18)' : '#16A34A',
          color: '#fff',
          fontSize: '9px', fontWeight: 800,
          padding: '4px 10px',
          borderBottomLeftRadius: '10px',
          letterSpacing: '0.6px',
        }}>
          BEST VALUE
        </div>
      )}

      {/* Check mark */}
      {active && (
        <div style={{
          position: 'absolute',
          top: hasBestValue ? '28px' : '14px',
          right: '14px',
          width: '20px', height: '20px',
          borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      {/* Period label */}
      <p style={{
        margin: 0, marginBottom: '12px',
        fontSize: '10px', fontWeight: 800,
        color: active ? 'rgba(255,255,255,0.55)' : colors.neutral[400],
        textTransform: 'uppercase', letterSpacing: '1.2px',
      }}>
        {period === 'monthly' ? 'Monthly' : 'Annual'}
      </p>

      {/* Price */}
      <p style={{ margin: 0, lineHeight: 1 }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: active ? 'rgba(255,255,255,0.7)' : colors.neutral[500] }}>Rs. </span>
        <span style={{ fontSize: '28px', fontWeight: 800, color: active ? '#fff' : colors.neutral[900], letterSpacing: '-0.5px' }}>
          {price !== null ? Math.round(price).toLocaleString() : '—'}
        </span>
      </p>

      {/* Billed note */}
      <p style={{ margin: '5px 0 0', fontSize: '11px', color: active ? 'rgba(255,255,255,0.5)' : colors.neutral[400] }}>
        {perMonth ? `Rs. ${perMonth.toLocaleString()}/mo · billed yearly` : 'billed monthly'}
      </p>

      {/* Savings */}
      {hasBestValue && (
        <p style={{
          margin: '12px 0 0', fontSize: '11px', fontWeight: 700,
          color: active ? '#86EFAC' : '#15803D',
        }}>
          Save Rs. {savings!.toLocaleString()} vs monthly
        </p>
      )}
    </button>
  );
}

// ── Pay modal ─────────────────────────────────────────────────────────────────

function PayModal({
  appCode,
  allApps,
  onClose,
  onSubmit,
  quotePrice,
}: {
  appCode: string;
  allApps: App[];
  onClose: () => void;
  onSubmit: (p: SubmitPaymentPayload) => Promise<{ ok: boolean }>;
  quotePrice: (appCodes: string[], plan: 'monthly' | 'yearly') => Promise<PriceQuote | null>;
}) {
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [method, setMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  // The app the modal opened for is always included; other apps can be
  // added to buy a discounted bundle in the same purchase (see
  // SubscriptionService.price_selection — 2+ apps = the platform's bundle
  // discount % applied to their summed prices).
  const [selectedCodes, setSelectedCodes] = useState<string[]>([appCode]);
  const [monthlyQuote, setMonthlyQuote] = useState<PriceQuote | null>(null);
  const [yearlyQuote, setYearlyQuote] = useState<PriceQuote | null>(null);
  const [quoting, setQuoting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setQuoting(true);
    Promise.all([quotePrice(selectedCodes, 'monthly'), quotePrice(selectedCodes, 'yearly')]).then(
      ([m, y]) => {
        if (cancelled) return;
        setMonthlyQuote(m);
        setYearlyQuote(y);
        setQuoting(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [selectedCodes, quotePrice]);

  const otherApps = allApps.filter((a) => a.code !== appCode);
  const monthlySavings = monthlyQuote && yearlyQuote
    ? Math.round(Number(monthlyQuote.total_npr) * 12 - Number(yearlyQuote.total_npr))
    : null;
  const activeQuote = plan === 'monthly' ? monthlyQuote : yearlyQuote;
  const perMonth = plan === 'yearly' && yearlyQuote ? Math.round(Number(yearlyQuote.total_npr) / 12) : null;

  const toggleApp = (code: string) => {
    if (code === appCode) return; // the app this modal opened for can't be deselected
    setSelectedCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  const handle = async () => {
    setBusy(true);
    const res = await onSubmit({ app_codes: selectedCodes, plan, payment_method: method || null, notes: notes || null });
    setBusy(false);
    if (res.ok) onClose();
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    border: `1.5px solid ${colors.neutral[200]}`,
    borderRadius: radius.sm,
    padding: '10px 12px',
    fontSize: '14px',
    color: colors.neutral[800],
    backgroundColor: colors.neutral[0],
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(10, 41, 71, 0.5)',
        backdropFilter: 'blur(2px)',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        width: '100%', maxWidth: '500px',
        borderRadius: '22px',
        backgroundColor: colors.neutral[0],
        boxShadow: '0 32px 80px rgba(10,41,71,0.22)',
        margin: `0 ${spacing.lg}`,
        overflow: 'hidden',
      }}>
        {/* Modal header */}
        <div style={{ padding: `${spacing.xl} ${spacing.xl} ${spacing.lg}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: colors.neutral[900], margin: 0, fontFamily: 'var(--font-playfair)' }}>
                Choose a plan
              </h2>
              <p style={{ marginTop: '4px', fontSize: '13px', color: colors.neutral[500], marginBottom: 0 }}>
                Payment is manual — our team confirms within 24 hours.
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                width: '30px', height: '30px', borderRadius: '50%',
                border: 'none', backgroundColor: colors.neutral[100],
                color: colors.neutral[500], fontSize: '16px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginLeft: spacing.md,
              }}
            >
              ✕
            </button>
          </div>

          {/* Bundle app selector — the current app is always included;
              adding more apps here prices the whole selection as one
              discounted bundle purchase (see price_selection below). */}
          {otherApps.length > 0 && (
            <div style={{ marginTop: spacing.lg }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: colors.neutral[600], marginBottom: '8px', letterSpacing: '0.2px' }}>
                Bundle with other apps <span style={{ fontWeight: 400, color: colors.neutral[400] }}>(optional — 2+ apps get a discount)</span>
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs }}>
                {allApps.map((a) => {
                  const isCurrent = a.code === appCode;
                  const isSelected = selectedCodes.includes(a.code);
                  return (
                    <button
                      key={a.code}
                      onClick={() => toggleApp(a.code)}
                      disabled={isCurrent}
                      style={{
                        padding: '6px 14px',
                        borderRadius: radius.full,
                        border: `1.5px solid ${isSelected ? colors.primary[800] : colors.neutral[200]}`,
                        backgroundColor: isSelected ? colors.primary[800] : colors.neutral[0],
                        color: isSelected ? '#fff' : colors.neutral[700],
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: isCurrent ? 'default' : 'pointer',
                        opacity: isCurrent ? 0.85 : 1,
                      }}
                    >
                      {a.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Plan cards */}
          <div style={{ marginTop: spacing.lg, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
            <PlanCard
              period="monthly"
              price={monthlyQuote ? Number(monthlyQuote.total_npr) : null}
              perMonth={null}
              disabled={quoting || !monthlyQuote}
              active={plan === 'monthly'}
              savings={null}
              onSelect={() => setPlan('monthly')}
            />
            <PlanCard
              period="yearly"
              price={yearlyQuote ? Number(yearlyQuote.total_npr) : null}
              perMonth={perMonth}
              disabled={quoting || !yearlyQuote}
              active={plan === 'yearly'}
              savings={monthlySavings}
              onSelect={() => setPlan('yearly')}
            />
          </div>

          {/* Bundle discount breakdown */}
          {activeQuote && Number(activeQuote.discount_amount_npr) > 0 && (
            <div style={{
              marginTop: spacing.md,
              padding: `${spacing.sm} ${spacing.md}`,
              borderRadius: radius.sm,
              backgroundColor: '#F0FDF4',
              border: '1px solid #BBF7D0',
              fontSize: '12px',
              color: '#15803D',
              display: 'flex',
              justifyContent: 'space-between',
            }}>
              <span>{activeQuote.lines.length} apps · {Number(activeQuote.discount_percent)}% bundle discount</span>
              <span style={{ fontWeight: 700 }}>−Rs. {Math.round(Number(activeQuote.discount_amount_npr)).toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: '1px', backgroundColor: colors.neutral[100] }} />

        {/* Fields */}
        <div style={{ padding: `${spacing.lg} ${spacing.xl}` }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: colors.neutral[600], marginBottom: '6px', letterSpacing: '0.2px' }}>
                Payment method
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = colors.primary[400])}
                onBlur={(e) => (e.currentTarget.style.borderColor = colors.neutral[200])}
              >
                <option value="">Select a method…</option>
                <option value="fonepay">FonePay / QR</option>
                <option value="esewa">eSewa</option>
                <option value="khalti">Khalti</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: colors.neutral[600], marginBottom: '6px', letterSpacing: '0.2px' }}>
                Notes / transaction ID{' '}
                <span style={{ fontWeight: 400, color: colors.neutral[400] }}>(optional)</span>
              </label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Transaction ID, receipt number…"
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = colors.primary[400])}
                onBlur={(e) => (e.currentTarget.style.borderColor = colors.neutral[200])}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: `${spacing.md} ${spacing.xl} ${spacing.xl}`,
          display: 'flex', gap: spacing.sm,
        }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              borderRadius: radius.full,
              border: `1.5px solid ${colors.neutral[200]}`,
              backgroundColor: colors.neutral[0],
              color: colors.neutral[600],
              fontSize: '14px', fontWeight: 600,
              padding: `10px ${spacing.lg}`,
              cursor: 'pointer',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.neutral[50])}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = colors.neutral[0])}
          >
            Cancel
          </button>
          <button
            onClick={handle}
            disabled={busy || quoting || !activeQuote}
            style={{
              flex: 2,
              borderRadius: radius.full,
              border: 'none',
              backgroundColor: colors.primary[800],
              color: '#fff',
              fontSize: '14px', fontWeight: 700,
              padding: `10px ${spacing.xl}`,
              cursor: busy || quoting || !activeQuote ? 'default' : 'pointer',
              opacity: busy || quoting || !activeQuote ? 0.6 : 1,
              transition: 'opacity 0.15s, background-color 0.15s',
            }}
            onMouseEnter={(e) => { if (!busy) e.currentTarget.style.backgroundColor = colors.primary[700]; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = colors.primary[800]; }}
          >
            {busy ? 'Submitting…' : 'Submit payment request'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function SubscriptionSection({
  appCode,
  sub,
  onSubmitPayment,
  quotePrice,
  allApps,
}: {
  appCode: string;
  sub: AppSubscription | null;
  onSubmitPayment: (p: SubmitPaymentPayload) => Promise<{ ok: boolean }>;
  quotePrice: (appCodes: string[], plan: 'monthly' | 'yearly') => Promise<PriceQuote | null>;
  allApps: App[];
}) {
  const [showPay, setShowPay] = useState(false);

  const needsAction =
    !sub || sub.status === 'expired' || sub.status === 'cancelled' ||
    (sub.status === 'trialing' && (daysUntil(sub.trial_ends_at) ?? 99) <= 7);

  const planLabel = sub?.plan === 'monthly' ? 'Monthly' : sub?.plan === 'yearly' ? 'Annual' : sub?.plan ?? null;

  return (
    <>
      <div style={{
        borderRadius: radius.lg,
        border: `1px solid ${colors.neutral[200]}`,
        backgroundColor: colors.neutral[0],
        padding: spacing.xl,
        display: 'flex',
        alignItems: 'center',
        gap: spacing.lg,
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <StatusBadge sub={sub} />
          <p style={{ margin: 0, fontSize: '12px', color: colors.neutral[400] }}>
            {sub?.status === 'trialing' && sub.trial_ends_at && `Trial ends ${formatDate(sub.trial_ends_at)}`}
            {sub?.status === 'active' && `${planLabel ? `${planLabel} plan · ` : ''}Renews ${formatDate(sub.period_end)}`}
            {sub?.status === 'expired' && `Expired ${formatDate(sub.trial_ends_at ?? sub.period_end)}`}
            {!sub && 'Start with a 30-day free trial or subscribe directly.'}
          </p>
        </div>

        <button
          onClick={() => setShowPay(true)}
          style={{
            flexShrink: 0,
            borderRadius: radius.full,
            padding: `10px ${spacing.xl}`,
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'opacity 0.15s, background-color 0.15s',
            border: needsAction ? 'none' : `1.5px solid ${colors.neutral[200]}`,
            backgroundColor: needsAction ? colors.primary[800] : colors.neutral[0],
            color: needsAction ? '#fff' : colors.neutral[600],
            boxShadow: needsAction ? '0 4px 14px rgba(10,41,71,0.2)' : 'none',
          }}
          onMouseEnter={(e) => {
            if (needsAction) e.currentTarget.style.backgroundColor = colors.primary[700];
            else e.currentTarget.style.backgroundColor = colors.neutral[50];
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = needsAction ? colors.primary[800] : colors.neutral[0];
          }}
        >
          {!sub || sub.status === 'expired' || sub.status === 'cancelled' ? 'Subscribe now' : 'Renew / upgrade'}
        </button>
      </div>

      {showPay && (
        <PayModal
          appCode={appCode}
          allApps={allApps}
          onClose={() => setShowPay(false)}
          onSubmit={onSubmitPayment}
          quotePrice={quotePrice}
        />
      )}
    </>
  );
}
