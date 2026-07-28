'use client';

import { useForm } from 'react-hook-form';
import { useEffect } from 'react';
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
        // New user, complete registration with Google profile
        const completeData: any = {
          email: response.data.email,
          full_name: response.data.name || 'User',
          business_name: '',
          business_address: '',
        };

        if (response.data.picture) {
          completeData.picture_url = response.data.picture;
        }

        const completeResponse = await authApi.googleComplete(completeData);

        if (completeResponse.data?.tokens) {
          setUser(completeResponse.data.user, 'user');
          router.push('/business-register');
        }
      }
    } catch (err: any) {
      setGoogleError(err.message || 'Google login failed');
    }
  };

  const handleGoogleError = () => {
    setGoogleError('Google login failed. Please try again.');
  };

  useEffect(() => {
    const google = (window as any).google;
    if (!google?.accounts?.id) return;

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error('Google Client ID not configured');
      setGoogleError('Google login not available. Please configure client ID.');
      return;
    }

    google.accounts.id.initialize({
      client_id: clientId,
      callback: (response: any) => {
        if (response.credential) {
          handleGoogleSuccess({ credential: response.credential });
        }
      },
    });
  }, []);

  const triggerGoogleLogin = () => {
    const google = (window as any).google;
    if (!google?.accounts?.id) {
      setGoogleError('Google API not available');
      return;
    }
    google.accounts.id.prompt((notification: any) => {
      if (!notification.isDisplayed()) {
        setGoogleError('Google login popup blocked. Please try again.');
      }
    });
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
        <span style={{ color: colors.neutral[500], fontSize: '13px' }}>Or</span>
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
      <button
        onClick={triggerGoogleLogin}
        type="button"
        style={{
          width: '100%',
          padding: `${spacing.md} ${spacing.xl}`,
          fontSize: '16px',
          fontWeight: '600',
          borderRadius: '24px',
          border: `1px solid ${colors.neutral[200]}`,
          backgroundColor: colors.neutral[50],
          color: colors.neutral[800],
          cursor: 'pointer',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.md,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = colors.neutral[100];
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = colors.neutral[50];
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24">
          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Sign in with Google
      </button>
    </form>
  );
}
