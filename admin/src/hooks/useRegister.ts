import { useState } from 'react';
import { useAuth } from './useAuth';
import { authApi } from '@/services/auth-api';
import { RegisterRequest, RegisterResponse } from '@/types/api';
import { ApiError } from '@/types/auth';

export function useRegister() {
  const { setUser, setUserType, setAuthError } = useAuth();
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const register = async (data: RegisterRequest): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await authApi.register(data);

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

      const responseData = response.data as RegisterResponse;
      if (!responseData?.user) {
        throw new Error('Invalid response from server');
      }
      setUser(responseData.user, 'user');

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
