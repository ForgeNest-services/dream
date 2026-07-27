'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { BusinessRegisterForm } from './forms/BusinessRegisterForm';
import { Spinner } from '@/components/shared/Spinner';
import { colors, spacing } from '@/lib/design-tokens';

export function BusinessRegisterContent() {
  const router = useRouter();
  const { isAuthenticated, isLoading, tenant } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (tenant) {
      router.push('/dashboard');
    }
  }, [tenant, router]);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.neutral[0],
      }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated || tenant) {
    return null;
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.neutral[0],
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: spacing.xl,
        }}>
          <h1 style={{
            fontSize: '36px',
            fontWeight: '700',
            color: colors.neutral[900],
            marginBottom: spacing.sm,
            fontFamily: 'var(--font-playfair)',
          }}>
            Complete Your Registration
          </h1>
          <p style={{
            fontSize: '16px',
            color: colors.neutral[600],
            marginTop: spacing.sm,
          }}>
            Add your business details
          </p>
        </div>

        <BusinessRegisterForm />
      </div>
    </div>
  );
}
