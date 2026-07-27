'use client';

import { useForm } from 'react-hook-form';
import { useRegister } from '@/hooks/useRegister';
import { RegisterRequest } from '@/types/api';
import { FormInput } from '@/components/ui/FormInput';
import { Button } from '@/components/ui/Button';
import { MdOutlinePerson, MdOutlineEmail, MdOutlineLock, MdOutlineCheckCircleOutline, MdOutlineErrorOutline } from 'react-icons/md';
import { colors, spacing } from '@/lib/design-tokens';

interface RegisterFormProps {
  onSuccess?: (email: string) => void;
}

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const { register, handleSubmit, formState: { errors }, watch } = useForm<RegisterRequest & { confirmPassword: string }>();
  const { register: submitRegister, isLoading, error } = useRegister();
  const password = watch('password');

  const onSubmit = async (data: RegisterRequest & { confirmPassword: string }) => {
    if (data.password !== data.confirmPassword) {
      return;
    }
    const success = await submitRegister(data as RegisterRequest);
    if (success && onSuccess) {
      onSuccess(data.email);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FormInput
        {...register('full_name', { required: 'Full name is required' })}
        type="text"
        placeholder="Full Name"
        label="Full Name"
        error={errors.full_name?.message}
        icon={<MdOutlinePerson size={20} />}
        disabled={isLoading}
      />

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
        disabled={isLoading}
      />

      <FormInput
        {...register('password', {
          required: 'Password is required',
          minLength: {
            value: 8,
            message: 'Password must be at least 8 characters',
          },
        })}
        type="password"
        placeholder="Password"
        label="Password"
        error={errors.password?.message}
        icon={<MdOutlineLock size={20} />}
        showPasswordToggle
        disabled={isLoading}
      />

      <FormInput
        {...register('confirmPassword', {
          required: 'Please confirm your password',
          validate: (value) => value === password || 'Passwords do not match',
        })}
        type="password"
        placeholder="Confirm Password"
        label="Confirm Password"
        error={errors.confirmPassword?.message}
        icon={<MdOutlineCheckCircleOutline size={20} />}
        showPasswordToggle
        disabled={isLoading}
      />

      {/* API Error */}
      {error && (
        <div
          style={{
            padding: spacing.md,
            backgroundColor: `${colors.status.error}15`,
            border: `1px solid ${colors.status.error}30`,
            borderRadius: '8px',
            marginBottom: spacing.lg,
            display: 'flex',
            gap: spacing.md,
          }}
        >
          <div style={{ color: colors.status.error, flexShrink: 0 }}>
            <MdOutlineErrorOutline size={20} />
          </div>
          <div>
            <p style={{ fontWeight: '600', color: colors.status.error, fontSize: '14px' }}>
              Registration Failed
            </p>
            <p style={{ color: colors.status.error, fontSize: '13px', opacity: 0.8 }}>
              {error.message}
            </p>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <Button type="submit" isLoading={isLoading} size="lg">
        {isLoading ? 'Creating Account...' : 'Create Account'}
      </Button>

      <p style={{ textAlign: 'center', fontSize: '13px', color: colors.neutral[500], marginTop: spacing.lg }}>
        We'll send a verification code to your email
      </p>
    </form>
  );
}
