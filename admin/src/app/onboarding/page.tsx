'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { BusinessRegisterForm } from '@/components/auth/forms/BusinessRegisterForm';
import { HospitalityMark } from '@/components/shared/HospitalityMark';
import { colors, spacing } from '@/lib/design-tokens';

// Business registration only — there's no "choose your free app" step
// anymore. Every app is open and usable immediately; each app's own
// 30-day trial starts independently the first time the tenant creates a
// staff credential for it (see SubscriptionService.start_trial_if_needed
// on the backend), not at signup.
export default function OnboardingPage() {
  const router = useRouter();
  const { isAuthenticated, tenant } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/');
      return;
    }
    if (tenant) {
      router.replace('/dashboard');
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
      <div style={{ width: '100%', maxWidth: '520px' }}>

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
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: colors.neutral[900], fontFamily: 'var(--font-playfair)', marginBottom: spacing.sm }}>
            Tell us about your business
          </h2>
          <p style={{ margin: `0 0 ${spacing['2xl']}`, fontSize: '14px', color: colors.neutral[500], lineHeight: '1.6' }}>
            This becomes the business record behind every app you run — shared across your team and printed on every invoice you generate.
          </p>
          <BusinessRegisterForm onSuccess={() => router.replace('/dashboard')} />
        </div>
      </div>
    </div>
  );
}
