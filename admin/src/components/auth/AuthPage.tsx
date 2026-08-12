'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
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
  const [otpExpiresIn, setOtpExpiresIn] = useState<number | undefined>(undefined);

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
    <div className="auth-page" style={{
      minHeight: '100vh',
      display: 'flex',
      backgroundColor: colors.neutral[0],
    }}>
      <style jsx>{`
        .auth-page {
          flex-direction: row;
        }
        .auth-branding {
          display: flex;
        }
        @media (max-width: 767px) {
          .auth-page {
            flex-direction: column;
          }
          .auth-branding {
            display: none;
          }
        }
      `}</style>

      {/* Left Side - Branding */}
      <div className="auth-branding" style={{
        flex: 1,
        background: `linear-gradient(135deg, ${colors.primary[800]} 0%, ${colors.primary[600]} 100%)`,
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
        color: colors.neutral[0],
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Abstract Background Elements */}
        <div style={{
          position: 'absolute',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.05)',
          top: '-100px',
          left: '-100px',
        }} />
        <div style={{
          position: 'absolute',
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.03)',
          bottom: '-50px',
          right: '-50px',
        }} />
        <div style={{
          position: 'absolute',
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.07)',
          top: '50%',
          right: '10%',
        }} />

        <div style={{ textAlign: 'center', maxWidth: '300px', position: 'relative', zIndex: 1 }}>
          <Image
            src="/logo-white.png"
            alt="Srota"
            width={789}
            height={290}
            priority
            style={{ height: '56px', width: 'auto', margin: '0 auto', marginBottom: spacing.lg }}
          />
          <p style={{
            fontSize: '16px',
            opacity: 0.85,
            lineHeight: '1.6',
          }}>
            Streamline your workflow and manage everything with ease
          </p>
        </div>
      </div>

      {/* Right Side - Form */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
        backgroundColor: colors.primary[50],
        minHeight: '100vh',
      }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          {/* Form Header */}
          {step !== 'verify-otp' && (
            <div style={{ marginBottom: spacing.xl }}>
              <h2 style={{
                fontSize: '24px',
                fontWeight: '600',
                color: colors.neutral[900],
                marginBottom: spacing.md,
              }}>
                {step === 'login' ? 'Welcome Back!' : 'Create Account'}
              </h2>
            </div>
          )}

          {/* Tabs */}
          {step !== 'verify-otp' && (
            <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.xl }}>
              <button
                onClick={() => setStep('login')}
                style={{
                  flex: 1,
                  padding: `${spacing.md} ${spacing.xl}`,
                  borderRadius: '24px',
                  fontWeight: '600',
                  fontSize: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  backgroundColor: step === 'login' ? colors.primary[800] : colors.neutral[100],
                  color: step === 'login' ? colors.neutral[0] : colors.neutral[700],
                }}
              >
                Sign In
              </button>
              <button
                onClick={() => setStep('register')}
                style={{
                  flex: 1,
                  padding: `${spacing.md} ${spacing.xl}`,
                  borderRadius: '24px',
                  fontWeight: '600',
                  fontSize: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  backgroundColor: step === 'register' ? colors.primary[800] : colors.neutral[100],
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
              onSuccess={(email, expiresIn) => {
                setRegistrationEmail(email);
                setOtpExpiresIn(expiresIn);
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
                  color: colors.primary[800],
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '500',
                  padding: 0,
                }}
              >
                ← Back
              </button>
              <OtpVerificationForm
                email={registrationEmail}
                initialExpiresIn={otpExpiresIn}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
