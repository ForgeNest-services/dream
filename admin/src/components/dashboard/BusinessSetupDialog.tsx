'use client';

import { useEffect } from 'react';
import { MdOutlineBusinessCenter } from 'react-icons/md';
import { BusinessRegisterForm } from '@/components/auth/forms/BusinessRegisterForm';
import { colors, spacing } from '@/lib/design-tokens';

export function BusinessSetupDialog() {
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // Non-dismissible: no click-outside handler, no ESC handler, no close button.

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="business-setup-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(10, 41, 71, 0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: spacing.lg,
      }}
    >
      <div
        style={{
          backgroundColor: colors.neutral[0],
          borderRadius: '20px',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: spacing['2xl'],
          boxShadow: '0 30px 80px rgba(10, 41, 71, 0.25)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: spacing.lg,
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              backgroundColor: colors.primary[50],
              color: colors.primary[800],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MdOutlineBusinessCenter size={28} />
          </div>
        </div>

        <p
          style={{
            fontSize: '12px',
            fontWeight: '600',
            color: colors.primary[800],
            textTransform: 'uppercase',
            letterSpacing: '1.2px',
            textAlign: 'center',
            margin: 0,
            marginBottom: spacing.xs,
          }}
        >
          One last thing
        </p>

        <h1
          id="business-setup-title"
          style={{
            fontSize: '28px',
            fontWeight: '700',
            color: colors.neutral[900],
            fontFamily: 'var(--font-playfair)',
            textAlign: 'center',
            margin: 0,
            marginBottom: spacing.sm,
          }}
        >
          Tell us about your business
        </h1>

        <p
          style={{
            fontSize: '14px',
            color: colors.neutral[600],
            textAlign: 'center',
            lineHeight: '1.6',
            margin: 0,
            marginBottom: spacing.xl,
          }}
        >
          This becomes the business record behind every app you run — shared across your team and printed on every invoice you send.
        </p>

        <BusinessRegisterForm />
      </div>
    </div>
  );
}
