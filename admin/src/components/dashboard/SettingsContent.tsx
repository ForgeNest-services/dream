'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  MdOutlineDescription,
  MdOutlineReceiptLong,
  MdOutlineImage,
  MdOutlineClose,
  MdOutlineLock,
  MdOutlineCheckCircle,
  MdOutlineInfo,
} from 'react-icons/md';
import { useAuth } from '@/hooks/useAuth';
import { useUpdateTaxInfo } from '@/hooks/useUpdateTaxInfo';
import { FormInput } from '@/components/ui/FormInput';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { colors, spacing } from '@/lib/design-tokens';
import { taxSettingsApi, type TaxSettingsResponse } from '@/services/tax-settings-api';
import type { ApiError } from '@/types/auth';

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const ACCEPTED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

export function SettingsContent() {
  const { tenant } = useAuth();
  const { update, isLoading } = useUpdateTaxInfo();

  const [pan, setPan] = useState(tenant?.pan ?? '');
  const [isVatRegistered, setIsVatRegistered] = useState(tenant?.is_vat_registered ?? false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoPick = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
      toast.error('Use a PNG, JPG, WEBP or SVG image.');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error('Image must be under 5MB.');
      return;
    }
    setLogoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const clearLogo = () => {
    setLogoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
          Business logo
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.lg }}>
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '16px',
              backgroundColor: colors.neutral[50],
              border: `1px dashed ${colors.neutral[300]}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="Business logo preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <MdOutlineImage size={28} color={colors.neutral[400]} />
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
            <div style={{ display: 'flex', gap: spacing.sm }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: `${spacing.sm} ${spacing.lg}`,
                  borderRadius: '24px',
                  border: `1px solid ${colors.neutral[300]}`,
                  backgroundColor: colors.neutral[0],
                  color: colors.neutral[800],
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                {logoPreview ? 'Replace image' : 'Upload image'}
              </button>
              {logoPreview && (
                <button
                  type="button"
                  onClick={clearLogo}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: `${spacing.sm} ${spacing.md}`,
                    borderRadius: '24px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: colors.status.error,
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  <MdOutlineClose size={15} />
                  Remove
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_LOGO_TYPES.join(',')}
              onChange={(e) => handleLogoPick(e.target.files?.[0])}
              style={{ display: 'none' }}
            />
            <p style={{ fontSize: '12px', color: colors.neutral[500], margin: 0, maxWidth: '360px' }}>
              PNG, JPG, WEBP or SVG, up to 5MB. Shown on invoices and receipts across every app.
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.sm,
            padding: `${spacing.sm} ${spacing.md}`,
            borderRadius: '12px',
            backgroundColor: colors.neutral[50],
          }}
        >
          <MdOutlineImage size={16} color={colors.neutral[500]} style={{ flexShrink: 0 }} />
          <p style={{ fontSize: '12px', color: colors.neutral[600], margin: 0, lineHeight: '1.5' }}>
            Preview only for now — saving isn't wired up yet.
          </p>
        </div>
      </section>

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

      {/* CBMS only applies to a VAT-registered business (दफा ६.४क) — hide
          for PAN-only rather than show a locked/disabled card. `tenant` is
          null while auth is still resolving, so this keeps the card visible
          until we actually know the registration status, avoiding a flash
          for a VAT tenant on load. */}
      {(tenant === null || tenant?.is_vat_registered) && <CbmsIntegrationCard />}
    </div>
  );
}

function CbmsIntegrationCard() {
  const [data, setData] = useState<TaxSettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingSync, setTogglingSync] = useState(false);

  const load = () => {
    taxSettingsApi
      .get()
      .then((res) => {
        if (res.data) setData(res.data);
      })
      .catch(() => {
        // Non-fatal — the rest of Settings still works without this card populated.
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const configured = !!data?.settings.ird_username && data.settings.ird_password_set;

  const handleSave = async () => {
    if (!username.trim() || !password.trim()) {
      toast.error('IRD username and password are required');
      return;
    }
    if (!consent) {
      toast.error('Accept the disclosure before saving');
      return;
    }
    setSaving(true);
    try {
      await taxSettingsApi.saveCredentials({
        ird_username: username.trim(),
        ird_password: password.trim(),
        consent: true,
      });
      toast.success('IRD credentials saved');
      setUsername('');
      setPassword('');
      setConsent(false);
      load();
    } catch (err) {
      const apiErr = err as ApiError;
      toast.error(apiErr?.message || 'Failed to save IRD credentials');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSync = async (next: boolean) => {
    setTogglingSync(true);
    try {
      await taxSettingsApi.setSyncEnabled(next);
      toast.success(next ? 'CBMS auto-sync enabled' : 'CBMS auto-sync disabled');
      load();
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.code === 'NOT_CERTIFIED_YET') {
        toast.error('This app is not yet IRD-certified — auto-sync can’t be enabled.');
      } else if (apiErr.code === 'CREDENTIALS_NOT_SAVED') {
        toast.error('Save IRD credentials first.');
      } else {
        toast.error(apiErr?.message || 'Failed to update sync setting');
      }
    } finally {
      setTogglingSync(false);
    }
  };

  return (
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
          marginBottom: spacing.sm,
        }}
      >
        IRD CBMS Integration
      </h2>
      <p style={{ fontSize: '12px', color: colors.neutral[600], margin: 0, marginBottom: spacing.lg, maxWidth: '480px' }}>
        Shared by every app you run — Inventory (IMS) and Restaurant POS (RMS) both submit bills
        through this one login, entered here once.
      </p>

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
        {configured ? (
          <MdOutlineCheckCircle size={16} color={colors.status.success} style={{ flexShrink: 0 }} />
        ) : (
          <MdOutlineInfo size={16} color={colors.neutral[500]} style={{ flexShrink: 0 }} />
        )}
        <p style={{ fontSize: '12px', color: colors.neutral[700], margin: 0, lineHeight: '1.5' }}>
          {loading
            ? 'Loading…'
            : configured
              ? `Configured · ${data?.settings.ird_username}`
              : 'Not configured yet'}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md, marginBottom: spacing.lg }}>
        <FormInput
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          type="text"
          placeholder="IRD Taxpayer Portal username"
          label="IRD username"
          icon={<MdOutlineLock size={20} />}
          disabled={saving}
        />
        <FormInput
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="IRD Taxpayer Portal password"
          label="IRD password"
          icon={<MdOutlineLock size={20} />}
          disabled={saving}
        />
      </div>

      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: spacing.sm,
          padding: spacing.md,
          borderRadius: '12px',
          backgroundColor: colors.neutral[50],
          marginBottom: spacing.lg,
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          style={{ marginTop: '2px', flexShrink: 0 }}
        />
        <span style={{ fontSize: '12px', color: colors.neutral[600], lineHeight: '1.5' }}>
          I understand this is our business&apos;s live IRD Taxpayer Portal login, not a scoped API
          key — it will be used to submit real bills to CBMS on our behalf once auto-sync is
          enabled below.
        </span>
      </label>

      <div style={{ width: 'fit-content', marginBottom: spacing.xl }}>
        <Button onClick={handleSave} isLoading={saving} size="md">
          Save credentials
        </Button>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: spacing.sm,
          padding: `${spacing.sm} ${spacing.md}`,
          borderRadius: '12px',
          backgroundColor: colors.neutral[50],
          marginBottom: spacing.md,
        }}
      >
        <MdOutlineInfo size={16} color={colors.neutral[500]} style={{ flexShrink: 0, marginTop: '1px' }} />
        <p style={{ fontSize: '12px', color: colors.neutral[600], margin: 0, lineHeight: '1.5' }}>
          This is voluntary. IRD hasn&apos;t published fixed revenue or transaction
          thresholds in this procedure — only that some taxpayers are individually
          designated for mandatory real-time submission. Turn this on if IRD has notified
          you it&apos;s required for your business, or if you want to comply early;
          otherwise your bills stay fully compliant without it.
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: spacing.md,
          borderRadius: '12px',
          border: `1px solid ${colors.neutral[200]}`,
          marginBottom: spacing.lg,
        }}
      >
        <div>
          <p style={{ fontSize: '13px', fontWeight: '600', color: colors.neutral[800], margin: 0 }}>
            Enable CBMS auto-sync
          </p>
          <p style={{ fontSize: '12px', color: colors.neutral[500], margin: 0, marginTop: '2px' }}>
            {configured
              ? 'Off by default. Each app also stays gated until it’s individually IRD-certified.'
              : 'Save credentials above first.'}
          </p>
        </div>
        <Switch
          checked={!!data?.settings.cbms_sync_enabled}
          onChange={handleToggleSync}
          disabled={!configured || togglingSync}
          aria-label="Enable CBMS auto-sync"
        />
      </div>

      {data && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: spacing.sm,
          }}
        >
          {[
            {
              label: 'Last synced',
              value: data.sync_summary.last_synced_at
                ? new Date(data.sync_summary.last_synced_at).toLocaleString()
                : '—',
            },
            { label: 'Pending', value: String(data.sync_summary.pending) },
            { label: 'Failed', value: String(data.sync_summary.failed) },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                padding: spacing.md,
                borderRadius: '12px',
                backgroundColor: colors.neutral[50],
                textAlign: 'center',
              }}
            >
              <p style={{ fontSize: '11px', color: colors.neutral[500], margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {stat.label}
              </p>
              <p style={{ fontSize: '18px', fontWeight: '700', color: colors.neutral[900], margin: 0, marginTop: '4px' }}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: '11px', color: colors.neutral[400], margin: 0, marginTop: spacing.lg }}>
        Detailed per-bill sync status and resync actions are available from each app&apos;s own
        Settings page.
      </p>
    </section>
  );
}
