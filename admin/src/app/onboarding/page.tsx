'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useApps } from '@/hooks/useApps';
import { authApi } from '@/services/auth-api';
import { BusinessRegisterForm } from '@/components/auth/forms/BusinessRegisterForm';
import { HospitalityMark } from '@/components/shared/HospitalityMark';
import { Spinner } from '@/components/shared/Spinner';
import { colors, spacing, radius } from '@/lib/design-tokens';
import type { App } from '@/types/apps';
import {
  MdOutlineHotel,
  MdOutlineRestaurant,
  MdOutlineFitnessCenter,
  MdOutlineInventory2,
  MdOutlinePool,
  MdOutlineApps,
  MdCheckCircle,
  MdArrowForward,
} from 'react-icons/md';
import type { IconType } from 'react-icons';

const ICON_MAP: Record<string, IconType> = {
  Hotel: MdOutlineHotel,
  Restaurant: MdOutlineRestaurant,
  Fitness: MdOutlineFitnessCenter,
  Inventory: MdOutlineInventory2,
  Pool: MdOutlinePool,
};

const APP_PALETTE = [
  { bg: '#E8EDF2', fg: colors.primary[800] },
  { bg: '#FDF3EC', fg: '#B5601C' },
  { bg: '#EAF6EE', fg: '#1E7A44' },
  { bg: '#F3ECFB', fg: '#6D3FBF' },
];

function paletteFor(code: string) {
  let hash = 0;
  for (let i = 0; i < code.length; i++) hash = (hash * 31 + code.charCodeAt(i)) >>> 0;
  return APP_PALETTE[hash % APP_PALETTE.length];
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing['2xl'] }}>
      {([1, 2] as const).map((s) => {
        const done = s < step;
        const active = s === step;
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: done ? colors.primary[800] : active ? colors.primary[800] : colors.neutral[200],
              color: done || active ? '#fff' : colors.neutral[500],
              fontSize: '12px', fontWeight: 800,
              transition: 'all 0.2s',
              flexShrink: 0,
            }}>
              {done ? <MdCheckCircle size={16} /> : s}
            </div>
            <span style={{
              fontSize: '12px', fontWeight: 600,
              color: active ? colors.neutral[900] : done ? colors.primary[700] : colors.neutral[400],
            }}>
              {s === 1 ? 'Business info' : 'Choose app'}
            </span>
            {s < 2 && (
              <div style={{ width: '32px', height: '1px', backgroundColor: done ? colors.primary[300] : colors.neutral[200], marginLeft: spacing.xs }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── App selection card ────────────────────────────────────────────────────────

function AppCard({
  app,
  selected,
  onSelect,
}: {
  app: App;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = (app.icon && ICON_MAP[app.icon]) || MdOutlineApps;
  const palette = paletteFor(app.code);

  return (
    <button
      onClick={onSelect}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.md,
        padding: spacing.xl,
        borderRadius: '16px',
        border: `2px solid ${selected ? colors.primary[800] : colors.neutral[200]}`,
        backgroundColor: selected ? colors.primary[800] : colors.neutral[0],
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.18s',
        position: 'relative',
        outline: 'none',
        boxShadow: selected ? '0 8px 24px rgba(10,41,71,0.18)' : 'none',
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = colors.primary[300];
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(10,41,71,0.08)';
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = colors.neutral[200];
          e.currentTarget.style.boxShadow = 'none';
        }
      }}
    >
      {selected && (
        <div style={{
          position: 'absolute', top: '12px', right: '12px',
          color: '#fff', display: 'flex',
        }}>
          <MdCheckCircle size={20} />
        </div>
      )}

      {/* Icon */}
      <div style={{
        width: '48px', height: '48px', borderRadius: '12px',
        backgroundColor: selected ? 'rgba(255,255,255,0.15)' : palette.bg,
        color: selected ? '#fff' : palette.fg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, overflow: 'hidden',
      }}>
        {app.icon_url
          ? <img src={app.icon_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : <Icon size={24} />
        }
      </div>

      {/* Name + tagline */}
      <div>
        <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: selected ? '#fff' : colors.neutral[900], fontFamily: 'var(--font-playfair)' }}>
          {app.name}
        </p>
        {app.tagline && (
          <p style={{ margin: `${spacing.xs} 0 0`, fontSize: '12px', color: selected ? 'rgba(255,255,255,0.65)' : colors.neutral[500], lineHeight: '1.45' }}>
            {app.tagline}
          </p>
        )}
      </div>

      {/* Trial badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        fontSize: '11px', fontWeight: 700,
        color: selected ? '#86EFAC' : '#15803D',
        backgroundColor: selected ? 'rgba(255,255,255,0.1)' : '#F0FDF4',
        border: selected ? '1px solid rgba(255,255,255,0.2)' : '1px solid #BBF7D0',
        borderRadius: radius.full,
        padding: '3px 10px',
        alignSelf: 'flex-start',
      }}>
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: selected ? '#86EFAC' : '#22C55E', flexShrink: 0 }} />
        30-day free trial
      </div>
    </button>
  );
}

// ── Step 2: Choose App ────────────────────────────────────────────────────────

function ChooseAppStep() {
  const router = useRouter();
  const { setTenant } = useAuth();
  const { apps, isLoading: appsLoading } = useApps();
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!selectedCode) return;
    setSubmitting(true);
    try {
      const res = await authApi.chooseApp(selectedCode);
      if (res.success && res.data?.tenant) {
        setTenant(res.data.tenant);
        toast.success('Your 30-day free trial has started!');
        router.replace('/dashboard');
      } else {
        toast.error('Something went wrong. Please try again.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to select app.');
    } finally {
      setSubmitting(false);
    }
  };

  if (appsLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: spacing['2xl'] }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: colors.neutral[900], fontFamily: 'var(--font-playfair)' }}>
        Choose your free app
      </h2>
      <p style={{ margin: `${spacing.sm} 0 ${spacing['2xl']}`, fontSize: '14px', color: colors.neutral[500], lineHeight: '1.6' }}>
        Pick one app to start with — free for 30 days, no card needed. Want more apps later?
        Contact us on WhatsApp to upgrade.
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: spacing.md,
        marginBottom: spacing['2xl'],
      }}>
        {apps.map((app) => (
          <AppCard
            key={app.id}
            app={app}
            selected={selectedCode === app.code}
            onSelect={() => setSelectedCode(app.code)}
          />
        ))}
      </div>

      <button
        onClick={handleConfirm}
        disabled={!selectedCode || submitting}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: radius.full,
          border: 'none',
          backgroundColor: selectedCode ? colors.primary[800] : colors.neutral[200],
          color: selectedCode ? '#fff' : colors.neutral[500],
          fontSize: '15px', fontWeight: 700,
          cursor: selectedCode && !submitting ? 'pointer' : 'default',
          opacity: submitting ? 0.7 : 1,
          transition: 'all 0.18s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
        }}
        onMouseEnter={(e) => { if (selectedCode && !submitting) e.currentTarget.style.backgroundColor = colors.primary[700]; }}
        onMouseLeave={(e) => { if (selectedCode) e.currentTarget.style.backgroundColor = colors.primary[800]; }}
      >
        {submitting ? 'Starting your trial…' : selectedCode ? 'Start free trial' : 'Select an app to continue'}
        {!submitting && selectedCode && <MdArrowForward size={18} />}
      </button>
    </div>
  );
}

// ── Main onboarding wizard ────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const { isAuthenticated, tenant } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/');
      return;
    }
    if (tenant?.free_app_code) {
      router.replace('/dashboard');
      return;
    }
    // If tenant exists but no free_app_code, skip to step 2
    if (tenant && !tenant.free_app_code) {
      setStep(2);
    }
  }, [isAuthenticated, tenant, router]);

  if (!isAuthenticated) return null;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.neutral[50],
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: `${spacing['3xl']} ${spacing.lg}`,
    }}>
      <div style={{ width: '100%', maxWidth: step === 2 ? '680px' : '520px', transition: 'max-width 0.3s ease' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing['2xl'] }}>
          <HospitalityMark size={36} />
          <span style={{ fontSize: '18px', fontWeight: 700, color: colors.primary[800], fontFamily: 'var(--font-playfair)' }}>
            Dream
          </span>
        </div>

        {/* Card */}
        <div style={{
          backgroundColor: colors.neutral[0],
          borderRadius: '20px',
          border: `1px solid ${colors.neutral[200]}`,
          padding: spacing['2xl'],
          boxShadow: '0 4px 24px rgba(10,41,71,0.06)',
        }}>
          <StepIndicator step={step} />

          {step === 1 && (
            <>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: colors.neutral[900], fontFamily: 'var(--font-playfair)', marginBottom: spacing.sm }}>
                Tell us about your business
              </h2>
              <p style={{ margin: `0 0 ${spacing['2xl']}`, fontSize: '14px', color: colors.neutral[500], lineHeight: '1.6' }}>
                This becomes the business record behind every app you run — shared across your team and printed on every invoice you generate.
              </p>
              <BusinessRegisterForm onSuccess={() => setStep(2)} />
            </>
          )}

          {step === 2 && <ChooseAppStep />}
        </div>
      </div>
    </div>
  );
}
