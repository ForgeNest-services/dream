'use client';

import { useForm } from 'react-hook-form';
import { usePasswordReset } from '@/hooks/usePasswordReset';
import { FormInput } from '@/components/ui/FormInput';
import { Button } from '@/components/ui/Button';
import { MdOutlineEmail } from 'react-icons/md';
import { colors, spacing } from '@/lib/design-tokens';

interface ForgotPasswordFormProps {
  onSent: (email: string, expiresIn?: number) => void;
  onBack: () => void;
}

export function ForgotPasswordForm({ onSent, onBack }: ForgotPasswordFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<{ email: string }>();
  const { sendResetOtp, isSending } = usePasswordReset();

  const onSubmit = async (data: { email: string }) => {
    const result = await sendResetOtp(data.email);
    if (result.ok) onSent(data.email, result.expiresIn);
  };

  return (
    <div>
      <h2 style={{ fontSize: '24px', fontWeight: '600', color: colors.neutral[900], marginBottom: spacing.sm }}>
        Forgot password?
      </h2>
      <p style={{ fontSize: '14px', color: colors.neutral[600], marginBottom: spacing.xl }}>
        Enter your email and we&apos;ll send you a code to reset your password.
      </p>

      <form onSubmit={handleSubmit(onSubmit)}>
        <FormInput
          {...register('email', {
            required: 'Email is required',
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: 'Invalid email address',
            },
          })}
          type="email"
          placeholder="Email"
          label="Email"
          error={errors.email?.message}
          icon={<MdOutlineEmail size={20} />}
          disabled={isSending}
        />

        <Button type="submit" isLoading={isSending} size="lg">
          {isSending ? 'Sending…' : 'Send reset code'}
        </Button>
      </form>

      <button
        type="button"
        onClick={onBack}
        style={{
          marginTop: spacing.lg,
          fontSize: '14px',
          color: colors.primary[800],
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontWeight: '500',
          padding: 0,
        }}
      >
        ← Back to sign in
      </button>
    </div>
  );
}
