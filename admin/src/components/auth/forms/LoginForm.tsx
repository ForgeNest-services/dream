'use client';

import { useForm } from 'react-hook-form';
import { useLogin } from '@/hooks/useLogin';
import { LoginRequest } from '@/types/api';
import { FormInput } from '@/components/ui/FormInput';
import { Button } from '@/components/ui/Button';
import { MdOutlineEmail, MdOutlineLock, MdOutlineErrorOutline } from 'react-icons/md';
import { colors, spacing } from '@/lib/design-tokens';

export function LoginForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<LoginRequest>();
  const { login, isLoading, error } = useLogin();

  const onSubmit = async (data: LoginRequest) => {
    await login(data);
  };

  return (
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
        disabled={isLoading}
      />

      <FormInput
        {...register('password', {
          required: 'Password is required',
          minLength: {
            value: 6,
            message: 'Password must be at least 6 characters',
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
              Login Failed
            </p>
            <p style={{ color: colors.status.error, fontSize: '13px', opacity: 0.8 }}>
              {error.message}
            </p>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <Button type="submit" isLoading={isLoading} size="lg">
        {isLoading ? 'Signing in...' : 'Sign In'}
      </Button>
    </form>
  );
}
