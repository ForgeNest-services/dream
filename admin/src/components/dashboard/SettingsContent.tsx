'use client';

import { useEffect, useState } from 'react';
import { MdOutlineDescription, MdOutlineReceiptLong } from 'react-icons/md';
import { useAuth } from '@/hooks/useAuth';
import { useUpdateTaxInfo } from '@/hooks/useUpdateTaxInfo';
import { FormInput } from '@/components/ui/FormInput';
import { Button } from '@/components/ui/Button';
import { colors, spacing } from '@/lib/design-tokens';

export function SettingsContent() {
  const { tenant } = useAuth();
  const { update, isLoading } = useUpdateTaxInfo();

  const [pan, setPan] = useState(tenant?.pan ?? '');
  const [isVatRegistered, setIsVatRegistered] = useState(tenant?.is_vat_registered ?? false);

  useEffect(() => {
    setPan(tenant?.pan ?? '');
    setIsVatRegistered(tenant?.is_vat_registered ?? false);
  }, [tenant]);

  const hasPan = pan.trim().length > 0;
  const dirty = pan !== (tenant?.pan ?? '') || isVatRegistered !== (tenant?.is_vat_registered ?? false);

  const registrationSummary = !hasPan
    ? 'No tax ID on file — invoices won’t include VAT.'
    : isVatRegistered
      ? 'VAT-registered — invoices will show 13% VAT.'
      : 'PAN-registered — invoices exclude VAT.';

  const handleSave = async () => {
    const ok = await update({ pan: pan.trim() || null, is_vat_registered: hasPan ? isVatRegistered : false });
    if (!ok) return;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['2xl'], maxWidth: '640px' }}>
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
          Settings
        </h1>
        <p style={{ fontSize: '14px', color: colors.neutral[600], marginTop: spacing.xs }}>
          Business details shared across every app you run.
        </p>
      </div>

      <section
        style={{
          padding: spacing.xl,
          backgroundColor: colors.neutral[0],
          border: `1px solid ${colors.neutral[200]}`,
          borderRadius: '16px',
        }}
      >
        <h2
          style={{
            fontSize: '13px',
            fontWeight: '600',
            color: colors.neutral[500],
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            marginBottom: spacing.lg,
          }}
        >
          Tax registration
        </h2>

        <FormInput
          value={pan}
          onChange={(e) => setPan(e.target.value)}
          type="text"
          placeholder="e.g. 123456789"
          label="PAN number"
          icon={<MdOutlineDescription size={20} />}
          disabled={isLoading}
        />

        {hasPan && (
          <div style={{ marginBottom: spacing.lg }}>
            <div
              role="radiogroup"
              aria-label="Tax registration type"
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.sm }}
            >
              {[
                { value: false, title: 'PAN only', hint: 'No VAT on invoices' },
                { value: true, title: 'VAT registered', hint: '13% VAT on invoices' },
              ].map((opt) => {
                const active = isVatRegistered === opt.value;
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={isLoading}
                    onClick={() => setIsVatRegistered(opt.value)}
                    style={{
                      textAlign: 'left',
                      padding: `${spacing.md} ${spacing.lg}`,
                      borderRadius: '16px',
                      border: `1.5px solid ${active ? colors.primary[800] : colors.neutral[200]}`,
                      backgroundColor: active ? colors.primary[50] : colors.neutral[0],
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span
                      style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: active ? colors.primary[800] : colors.neutral[800],
                      }}
                    >
                      {opt.title}
                    </span>
                    <span style={{ display: 'block', fontSize: '12px', color: colors.neutral[500], marginTop: '2px' }}>
                      {opt.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.sm,
            padding: `${spacing.sm} ${spacing.md}`,
            borderRadius: '12px',
            backgroundColor: colors.neutral[50],
            marginBottom: spacing.lg,
          }}
        >
          <MdOutlineReceiptLong size={16} color={colors.neutral[500]} style={{ flexShrink: 0 }} />
          <p style={{ fontSize: '12px', color: colors.neutral[600], margin: 0, lineHeight: '1.5' }}>
            {registrationSummary}
          </p>
        </div>

        <div style={{ width: 'fit-content' }}>
          <Button onClick={handleSave} isLoading={isLoading} disabled={!dirty} size="md">
            Save changes
          </Button>
        </div>
      </section>
    </div>
  );
}
