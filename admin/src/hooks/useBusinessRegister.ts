import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './useAuth';
import { authApi } from '@/services/auth-api';
import { BusinessRegisterRequest, BusinessRegisterResponse } from '@/types/api';
import { ApiError } from '@/types/auth';

export function useBusinessRegister() {
  const router = useRouter();
  const { setTenant, setTokens, setUser, setUserType, setAuthError } = useAuth();
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const register = async (data: BusinessRegisterRequest): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await authApi.businessRegister(data);

      if (!response.success) {
        const errorMsg = response.error?.message || 'Registration failed';
        setError({
          code: response.error?.code || 'REGISTRATION_FAILED',
          message: errorMsg,
          statusCode: 400,
        });
        setAuthError(errorMsg);
        return false;
      }

      const responseData = response.data as BusinessRegisterResponse;

      setTokens(responseData.tokens);
      setUser(responseData.user, 'user');
      setTenant(responseData.tenant);

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

  return { register, isLoading, error, clearError: () => setError(null) };
}
