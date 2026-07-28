'use client';

import { useForm } from 'react-hook-form';
import { GoogleLogin } from '@react-oauth/google';
import { useLogin } from '@/hooks/useLogin';
import { LoginRequest } from '@/types/api';
import { FormInput } from '@/components/ui/FormInput';
import { Button } from '@/components/ui/Button';
import { MdOutlineEmail, MdOutlineLock, MdOutlineErrorOutline } from 'react-icons/md';
import { colors, spacing } from '@/lib/design-tokens';
import { authApi } from '@/services/auth-api';
import { useAuthStore } from '@/store/auth-store';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LoginForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<LoginRequest>();
  const { login, isLoading, error } = useLogin();
  const setUser = useAuthStore((state) => state.setUser);
  const setTokens = useAuthStore((state) => state.tokens);
  const router = useRouter();
  const [googleError, setGoogleError] = useState<string | null>(null);

  const onSubmit = async (data: LoginRequest) => {
    await login(data);
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      setGoogleError(null);
      const idToken = credentialResponse.credential;
      const response = await authApi.googleCallback({ id_token: idToken });

      if (!response.data) {
        throw new Error('Invalid response from server');
      }

      if (response.data.user_exists && response.data.user) {
        // User exists, login directly
        setUser(response.data.user, 'user');
        router.push('/dashboard');
      } else {
        // New user, redirect to complete registration
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
