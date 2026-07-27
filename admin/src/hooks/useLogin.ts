import { useState } from 'react';
import { useRouter } from 'next/navigation';
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

      if (!response.success) {
        const errorMsg = response.error?.message || 'Login failed';
        setError({
          code: response.error?.code || 'LOGIN_FAILED',
          message: errorMsg,
          statusCode: 400,
        });
        setAuthError(errorMsg);
        return false;
      }

      const responseData = response.data as LoginResponse | SuperadminLoginResponse;

      if ('is_superadmin' in responseData) {
        // Superadmin login
        const adminResponse = responseData as SuperadminLoginResponse;
        setTokens(adminResponse.tokens);
        setUser({
          id: adminResponse.admin_id,
          is_active: true,
        } as PlatformAdmin, 'superadmin');
      } else {
        // Regular user login
        const userResponse = responseData as LoginResponse;
        setTokens(userResponse.tokens);
        setUser(userResponse.user, 'user');

        if (!userResponse.user.tenant_id) {
          router.push('/business-register');
          return true;
        }
      }

      router.push('/dashboard');
      return true;
    } catch (err) {
      const apiError = err instanceof Error ? (err as unknown as ApiError) : {
        code: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred',
        statusCode: 500,
      };
      setError(apiError);
      setAuthError(apiError.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return { login, isLoading, error, clearError: () => setError(null) };
}
