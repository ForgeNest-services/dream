import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import { authApi } from '@/services/auth-api';
import { LoginRequest, LoginResponse, SuperadminLoginResponse } from '@/types/api';
import { ApiError, PlatformAdmin } from '@/types/auth';

export function useLogin() {
  const router = useRouter();
  const { setUser, setUserType, setTenant, setTokens, setAuthError } = useAuth();
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = async (data: LoginRequest): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await authApi.login(data);
      const responseData = response.data as LoginResponse | SuperadminLoginResponse;

      if ('is_superadmin' in responseData) {
        const adminResponse = responseData as SuperadminLoginResponse;
        setTokens(adminResponse.tokens);
        setUser({
          id: adminResponse.admin_id,
          is_active: true,
        } as PlatformAdmin, 'superadmin');
      } else {
        const userResponse = responseData as LoginResponse;
        setTokens(userResponse.tokens);
        setUser(userResponse.user, 'user');

        if (!userResponse.user.tenant_id) {
          toast.success('Welcome! Please complete your business registration.');
          router.push('/business-register');
          return true;
        }
      }

      toast.success('Signed in successfully');
      router.push('/dashboard');
      return true;
    } catch (err) {
      const apiError = err as ApiError;
      const code = apiError?.code || 'LOGIN_FAILED';
      const message = apiError?.message || 'Login failed';

      if (code === 'USER_NOT_FOUND') {
        toast.error('No account found with this email. Please register first.');
      } else if (code === 'EMAIL_NOT_VERIFIED') {
        toast.warning('Please verify your email before logging in.');
      } else if (code === 'INVALID_CREDENTIALS') {
        toast.error('Incorrect password. Please try again.');
      } else {
        toast.error(message);
      }

      setError({ code, message, statusCode: apiError?.statusCode || 400 });
      setAuthError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return { login, isLoading, error, clearError: () => setError(null) };
}
