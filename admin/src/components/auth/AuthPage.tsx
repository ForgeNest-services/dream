'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { LoginForm } from './forms/LoginForm';
import { RegisterForm } from './forms/RegisterForm';
import { OtpVerificationForm } from './forms/OtpVerificationForm';
import { Spinner } from '@/components/shared/Spinner';
import { colors, spacing } from '@/lib/design-tokens';

type AuthStep = 'login' | 'register' | 'verify-otp';

export function AuthPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [step, setStep] = useState<AuthStep>('login');
  const [registrationEmail, setRegistrationEmail] = useState('');

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.neutral[0] }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
      backgroundColor: colors.neutral[0],
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: spacing.xl }}>
          <h1 style={{
            fontSize: '36px',
            fontWeight: '700',
            color: colors.neutral[900],
            marginBottom: spacing.sm,
            fontFamily: 'var(--font-playfair)',
          }}>
            Dream
          </h1>
          <p style={{ fontSize: '16px', color: colors.neutral[500] }}>
            Admin Dashboard
          </p>
        </div>

        {/* Tabs */}
        {step !== 'verify-otp' && (
          <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.xl }}>
            <button
              onClick={() => setStep('login')}
              style={{
                flex: 1,
                padding: `${spacing.md} ${spacing.lg}`,
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                backgroundColor: step === 'login' ? colors.primary[400] : colors.neutral[100],
                color: step === 'login' ? colors.neutral[0] : colors.neutral[700],
              }}
            >
              Sign In
            </button>
            <button
              onClick={() => setStep('register')}
              style={{
                flex: 1,
                padding: `${spacing.md} ${spacing.lg}`,
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                backgroundColor: step === 'register' ? colors.primary[400] : colors.neutral[100],
                color: step === 'register' ? colors.neutral[0] : colors.neutral[700],
              }}
            >
              Sign Up
            </button>
          </div>
        )}

        {/* Forms */}
        {step === 'login' && <LoginForm />}

        {step === 'register' && (
          <RegisterForm
            onSuccess={(email) => {
              setRegistrationEmail(email);
              setStep('verify-otp');
            }}
          />
        )}

        {step === 'verify-otp' && (
          <div>
            <button
              onClick={() => setStep('register')}
              style={{
                marginBottom: spacing.lg,
                fontSize: '14px',
                color: colors.primary[400],
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '500',
                padding: 0,
              }}
            >
              ← Back
            </button>
            <OtpVerificationForm email={registrationEmail} />
          </div>
        )}
      </div>
    </div>
  );
}
