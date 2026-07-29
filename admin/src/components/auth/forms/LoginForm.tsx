'use client';

import { useForm } from 'react-hook-form';
import { GoogleLogin } from '@react-oauth/google';
import { toast } from 'sonner';
import { useLogin } from '@/hooks/useLogin';
import { LoginRequest } from '@/types/api';
import { FormInput } from '@/components/ui/FormInput';
import { Button } from '@/components/ui/Button';
import { MdOutlineEmail, MdOutlineLock } from 'react-icons/md';
import { colors, spacing } from '@/lib/design-tokens';
import { authApi } from '@/services/auth-api';
import { useAuthStore } from '@/store/auth-store';
import { useRouter } from 'next/navigation';

export function LoginForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<LoginRequest>();
  const { login, isLoading } = useLogin();
  const setUser = useAuthStore((state) => state.setUser);
  const setTokens = useAuthStore((state) => state.setTokens);
  const setTenant = useAuthStore((state) => state.setTenant);
  const router = useRouter();

  const onSubmit = async (data: LoginRequest) => {
    await login(data);
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      const idToken = credentialResponse.credential;
      const response = await authApi.googleCallback({ id_token: idToken });

      if (!response.data) {
        throw new Error('Invalid response from server');
      }

      if (response.data.user_exists && response.data.user) {
        if (response.data.tokens) {
          setTokens(response.data.tokens);
        }
        setUser(response.data.user, 'user');
        toast.success('Signed in successfully');
        router.push('/dashboard');
      } else {
        const completeData: any = {
          email: response.data.email,
          full_name: response.data.name || 'User',
        };

        if (response.data.picture) {
          completeData.picture_url = response.data.picture;
        }

        const completeResponse = await authApi.googleComplete(completeData);

        if (completeResponse.data?.tokens) {
          setTokens(completeResponse.data.tokens);
          setUser(completeResponse.data.user, 'user');
          if (completeResponse.data.tenant) {
            setTenant(completeResponse.data.tenant);
          }
          toast.success('Account created successfully');
          router.push('/dashboard');
        }
      }
    } catch (err: any) {
      toast.error(err?.message || 'Google login failed');
    }
  };

  const handleGoogleError = () => {
    toast.error('Google login failed. Please try again.');
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

      {/* Google Login Button */}
      <div style={{ width: '100%' }}>
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          theme="outline"
          size="large"
          text="continue_with"
          shape="pill"
          width="100%"
        />
      </div>
    </form>
  );
}
