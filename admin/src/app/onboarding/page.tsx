'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Fraunces } from 'next/font/google';
import Image from 'next/image';
import { Lottie } from 'lottie-react';
import { useAuth } from '@/hooks/useAuth';
import { BusinessRegisterForm, type BusinessFormFields } from '@/components/auth/forms/BusinessRegisterForm';
import { colors, spacing } from '@/lib/design-tokens';

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
});

// Business registration only — there's no "choose your free app" step
// anymore. Every app is open and usable immediately; each app's own
// 30-day trial starts independently the first time the tenant creates a
// staff credential for it (see SubscriptionService.start_trial_if_needed
// on the backend), not at signup.

const EMPTY_FIELDS: BusinessFormFields = {
  businessName: '',
  businessAddress: '',
  pan: '',
  isVatRegistered: false,
  businessEmail: '',
  businessPhone: '',
};

function todayBs(): string {
  // Lightweight display date for the receipt preview — not the source of
  // truth for any stored date, purely decorative context on the mock slip.
  return new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** The signature element: a live receipt that fills in as the owner types,
 *  because that's literally what this record becomes — the header printed
 *  on every invoice the business issues (see CLAUDE.md §2.9/§2.10). Makes
 *  the abstract act of "registering a business" visibly concrete. */
function ReceiptPreview({ fields }: { fields: BusinessFormFields }) {
  const hasPan = fields.pan.trim().length === 9;
  const taxLine = !fields.pan.trim()
    ? null
    : hasPan
      ? fields.isVatRegistered
        ? { label: 'VAT REG.', value: fields.pan }
        : { label: 'PAN', value: fields.pan }
      : { label: 'PAN', value: fields.pan.padEnd(9, '·') };

  return (
    <div
      style={{
        position: 'relative',
        backgroundColor: '#FFFFFF',
        borderRadius: '4px',
        padding: `${spacing.xl} ${spacing.lg}`,
        boxShadow: '0 24px 48px -12px rgba(0,0,0,0.35)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* perforated top edge */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '-1px',
          left: 0,
          right: 0,
          height: '10px',
          backgroundImage: `radial-gradient(circle at 10px 0, transparent 5px, #FFFFFF 5.5px)`,
          backgroundSize: '20px 10px',
          backgroundRepeat: 'repeat-x',
          transform: 'translateY(-9px)',
        }}
      />

      <div style={{ textAlign: 'center', paddingBottom: spacing.md, marginBottom: spacing.md, borderBottom: `1.5px dashed ${colors.neutral[200]}` }}>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-fraunces)',
            fontStyle: 'italic',
            fontSize: '19px',
            fontWeight: 600,
            color: colors.neutral[900],
            lineHeight: '1.3',
            wordBreak: 'break-word',
          }}
        >
          {fields.businessName.trim() || 'Your business name'}
        </p>
        <p style={{ margin: `${spacing.xs} 0 0`, fontSize: '11px', color: colors.neutral[400], lineHeight: '1.5' }}>
          {fields.businessAddress.trim() || 'Business address'}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', fontSize: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: colors.neutral[500] }}>
          <span>DATE (AD)</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: colors.neutral[700] }}>{todayBs()}</span>
        </div>
        {taxLine ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: colors.neutral[500] }}>
            <span>{taxLine.label}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: colors.neutral[700], letterSpacing: '0.5px' }}>{taxLine.value}</span>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: colors.neutral[300] }}>
            <span>TAX ID</span>
            <span>not registered</span>
          </div>
        )}
        {(fields.businessPhone.trim() || fields.businessEmail.trim()) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: colors.neutral[500] }}>
            <span>CONTACT</span>
            <span style={{ color: colors.neutral[700], textAlign: 'right', maxWidth: '65%', wordBreak: 'break-word' }}>
              {fields.businessPhone.trim() || fields.businessEmail.trim()}
            </span>
          </div>
        )}
      </div>

      <div style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTop: `1.5px dashed ${colors.neutral[200]}`, textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '10px', letterSpacing: '1.5px', color: colors.neutral[300], textTransform: 'uppercase' }}>
          This heads every invoice you send
        </p>
      </div>

      {/* perforated bottom edge */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: '-1px',
          left: 0,
          right: 0,
          height: '10px',
          backgroundImage: `radial-gradient(circle at 10px 10px, transparent 5px, #FFFFFF 5.5px)`,
          backgroundSize: '20px 10px',
          backgroundRepeat: 'repeat-x',
          transform: 'translateY(9px)',
        }}
      />
    </div>
  );
}

/** Plays once after a successful save, then hands off to /dashboard — the
 *  one moment in this flow that earns a burst of energy, after the quiet,
 *  serious work of registering tax details is actually done. */
function LaunchOverlay({ businessName, onFinished }: { businessName: string; onFinished: () => void }) {
  useEffect(() => {
    const t = setTimeout(onFinished, 2600);
    return () => clearTimeout(t);
  }, [onFinished]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        backgroundColor: '#F8F8F8',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
      }}
    >
      <div style={{ width: 'min(360px, 70vw)' }}>
        <Lottie src="/animations/businessman_lies_up_with_rocket.json" autoplay loop={false} />
      </div>
      <p
        style={{
          margin: 0,
          marginTop: spacing.md,
          fontFamily: 'var(--font-fraunces)',
          fontWeight: 600,
          fontSize: '24px',
          color: colors.neutral[900],
          textAlign: 'center',
        }}
      >
        {businessName.trim() || 'Your business'} is live.
      </p>
      <p style={{ margin: 0, marginTop: spacing.xs, fontSize: '14px', color: colors.neutral[500] }}>
        Taking you to your dashboard…
      </p>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const { isAuthenticated, tenant } = useAuth();
  const [fields, setFields] = useState<BusinessFormFields>(EMPTY_FIELDS);
  const [launching, setLaunching] = useState(false);
  // A ref, not state: BusinessRegisterForm's onSubmit calls setTenant()
  // (Zustand) *before* it awaits and calls onSuccess() -> setLaunching(true).
  // setTenant() alone triggers a re-render of this component, and that
  // render's effect can see tenant != null while `launching` state hasn't
  // committed yet (state updates aren't synchronous) — the effect would
  // redirect to /dashboard before the launch overlay ever gets a chance to
  // mount. A ref set synchronously the instant submission starts closes
  // that gap; the effect below checks it directly, no render round-trip.
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/');
      return;
    }
    if (tenant && !launching && !submittingRef.current) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, tenant, launching, router]);

  if (!isAuthenticated) return null;

  return (
    <div className={fraunces.variable} style={{ minHeight: '100vh', display: 'flex', backgroundColor: colors.neutral[0] }}>
      <style jsx global>{`
        @media (max-width: 899px) {
          .onboarding-receipt-panel {
            display: none !important;
          }
        }
      `}</style>

      {/* Left — sticky navy panel, live receipt */}
      <div
        className="onboarding-receipt-panel"
        style={{
          flex: '0 0 42%',
          maxWidth: '640px',
          minHeight: '100vh',
          position: 'sticky',
          top: 0,
          alignSelf: 'flex-start',
          background: `linear-gradient(160deg, ${colors.primary[800]} 0%, #071B30 100%)`,
          padding: `${spacing['3xl']} ${spacing['3xl']}`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden',
        }}
      >
        {/* ambient texture */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            width: '520px',
            height: '520px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(219,138,62,0.10) 0%, transparent 70%)',
            top: '-160px',
            right: '-160px',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing['3xl'] }}>
            <Image src="/logo-white.png" alt="Srota" width={789} height={290} priority style={{ height: '30px', width: 'auto' }} />
          </div>

          <p
            style={{
              margin: 0,
              maxWidth: '380px',
              fontFamily: 'var(--font-fraunces)',
              fontWeight: 500,
              fontSize: 'clamp(26px, 2.6vw, 34px)',
              lineHeight: '1.22',
              color: '#FFFFFF',
              letterSpacing: '-0.01em',
            }}
          >
            This becomes what your customers see on every bill.
          </p>
          <p style={{ marginTop: spacing.lg, maxWidth: '340px', fontSize: '14px', lineHeight: '1.7', color: 'rgba(255,255,255,0.6)' }}>
            One business record, shared by your whole team and every app you run — hotel, restaurant, or shop floor.
          </p>
        </div>

        <div style={{ position: 'relative', zIndex: 1, maxWidth: '340px' }}>
          <ReceiptPreview fields={fields} />
        </div>

        <p style={{ position: 'relative', zIndex: 1, margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
          Need help? Reach us on WhatsApp — we reply fast.
        </p>
      </div>

      {/* Right — the form */}
      <div
        style={{
          flex: 1,
          minHeight: '100vh',
          backgroundColor: '#F8F8F8',
          display: 'flex',
          justifyContent: 'center',
          padding: `${spacing['3xl']} ${spacing.lg}`,
        }}
      >
        <div style={{ width: '100%', maxWidth: '520px' }}>
          <p
            style={{
              margin: 0,
              marginBottom: spacing.sm,
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '1.6px',
              textTransform: 'uppercase',
              color: colors.accent[700],
            }}
          >
            Before you begin
          </p>
          <h1
            style={{
              margin: 0,
              marginBottom: spacing.sm,
              fontFamily: 'var(--font-fraunces)',
              fontWeight: 600,
              fontSize: 'clamp(28px, 3.4vw, 38px)',
              color: colors.neutral[900],
              letterSpacing: '-0.015em',
              lineHeight: '1.15',
            }}
          >
            Let&rsquo;s hear about your business.
          </h1>
          <p style={{ margin: `0 0 ${spacing['2xl']}`, fontSize: '15px', color: colors.neutral[600], lineHeight: '1.65', maxWidth: '440px' }}>
            A few details now save re-typing them later — every app you add reads from this one record.
          </p>

          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              border: `1px solid ${colors.neutral[200]}`,
              padding: spacing['2xl'],
              boxShadow: '0 1px 2px rgba(10,41,71,0.04)',
            }}
          >
            <BusinessRegisterForm
              onSubmitStart={() => {
                submittingRef.current = true;
              }}
              onSuccess={() => setLaunching(true)}
              onFieldsChange={setFields}
            />
          </div>
        </div>
      </div>

      {launching && (
        <LaunchOverlay businessName={fields.businessName} onFinished={() => router.replace('/dashboard')} />
      )}
    </div>
  );
}
