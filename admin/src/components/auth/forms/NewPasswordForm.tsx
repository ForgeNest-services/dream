'use client';

import { useForm } from 'react-hook-form';
import { usePasswordReset } from '@/hooks/usePasswordReset';
import { FormInput } from '@/components/ui/FormInput';
import { Button } from '@/components/ui/Button';
import { MdOutlineLock, MdOutlineCheckCircleOutline } from 'react-icons/md';
import { colors, spacing } from '@/lib/design-tokens';

interface NewPasswordFormProps {
  resetToken: string;
  onDone: () => void;
}

interface FormValues {
  password: string;
  confirmPassword: string;
}

export function NewPasswordForm({ resetToken, onDone }: NewPasswordFormProps) {
  const { register, handleSubmit, formState: { errors }, watch } = useForm<FormValues>();
  const { resetPassword, isResetting } = usePasswordReset();
  const password = watch('password');

  const onSubmit = async (data: FormValues) => {
    const ok = await resetPassword(resetToken, data.password);
    if (ok) onDone();
  };

  return (
    <div>
      <h2 style={{ fontSize: '24px', fontWeight: '600', color: colors.neutral[900], marginBottom: spacing.sm }}>
        Set a new password
      </h2>
      <p style={{ fontSize: '14px', color: colors.neutral[600], marginBottom: spacing.xl }}>
        Choose a new password for your account.
      </p>

      <form onSubmit={handleSubmit(onSubmit)}>
        <FormInput
          {...register('password', {
            required: 'Password is required',
            minLength: {
              value: 8,
              message: 'Password must be at least 8 characters',
            },
          })}
          type="password"
          placeholder="New password"
          label="New password"
          error={errors.password?.message}
          icon={<MdOutlineLock size={20} />}
          showPasswordToggle
          disabled={isResetting}
        />

        <FormInput
          {...register('confirmPassword', {
            required: 'Please confirm your password',
            validate: (value) => value === password || 'Passwords do not match',
          })}
          type="password"
          placeholder="Confirm new password"
          label="Confirm new password"
          error={errors.confirmPassword?.message}
          icon={<MdOutlineCheckCircleOutline size={20} />}
          showPasswordToggle
          disabled={isResetting}
        />

        <Button type="submit" isLoading={isResetting} size="lg">
          {isResetting ? 'Resetting…' : 'Reset password'}
        </Button>
      </form>
    </div>
  );
}
