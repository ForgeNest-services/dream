'use client';

import { useForm } from 'react-hook-form';
import { GoogleLogin } from '@react-oauth/google';
import { useRegister } from '@/hooks/useRegister';
import { RegisterRequest } from '@/types/api';
import { FormInput } from '@/components/ui/FormInput';
import { Button } from '@/components/ui/Button';
import { MdOutlinePerson, MdOutlineEmail, MdOutlineLock, MdOutlineCheckCircleOutline, MdOutlineErrorOutline } from 'react-icons/md';
import { colors, spacing } from '@/lib/design-tokens';
import { authApi } from '@/services/auth-api';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface RegisterFormProps {
  onSuccess?: (email: string) => void;
}

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const { register, handleSubmit, formState: { errors }, watch } = useForm<RegisterRequest & { confirmPassword: string }>();
  const { register: submitRegister, isLoading, error } = useRegister();
  const password = watch('password');
  const router = useRouter();
  const [googleError, setGoogleError] = useState<string | null>(null);

  const onSubmit = async (data: RegisterRequest & { confirmPassword: string }) => {
    if (data.password !== data.confirmPassword) {
      return;
    }
    const success = await submitRegister(data as RegisterRequest);
    if (success && onSuccess) {
      onSuccess(data.email);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      setGoogleError(null);
      const idToken = credentialResponse.credential;
      const response = await authApi.googleCallback({ id_token: idToken });

      if (!response.data) {
        throw new Error('Invalid response from server');
      }

      if (response.data.user_exists) {
        // User already exists, redirect to login
        router.push('/');
      } else {
        // New user, save details and redirect to business registration
        localStorage.setItem('googleRegistration', JSON.stringify({
          email: response.data.email,
          name: response.data.name,
          picture: response.data.picture,
          id_token: idToken,
        }));
        router.push('/business-register');
      }
    } catch (err: any) {
      setGoogleError(err.message || 'Google login failed');
    }
  };

  const handleGoogleError = () => {
    setGoogleError('Google login failed. Please try again.');
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

      {/* Google Login Divider */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing.md,
        marginTop: spacing.xl,
        marginBottom: spacing.xl,
      }}>
        <div style={{ flex: 1, height: '1px', backgroundColor: colors.neutral[200] }} />
        <span style={{ color: colors.neutral[500], fontSize: '13px' }}>Or continue with</span>
        <div style={{ flex: 1, height: '1px', backgroundColor: colors.neutral[200] }} />
      </div>

      {/* Google Error */}
      {googleError && (
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
          <p style={{ color: colors.status.error, fontSize: '13px' }}>
            {googleError}
          </p>
        </div>
      )}

      {/* Google Login Button */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          theme="outline"
          size="large"
        />
      </div>
    </form>
  );
}
