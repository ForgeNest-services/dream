import { useState } from 'react';
import { toast } from 'sonner';
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
      const responseData = response.data as RegisterResponse;
      if (!responseData?.user) {
        throw new Error('Invalid response from server');
      }
      setUser(responseData.user, 'user');

      toast.success('Account created! Check your email for the verification code.');
      return true;
    } catch (err) {
      const apiError = err as ApiError;
      const code = apiError?.code || 'REGISTRATION_FAILED';
      const message = apiError?.message || 'Registration failed';

      if (code === 'EMAIL_ALREADY_EXISTS') {
        toast.error('This email is already registered. Please sign in instead.');
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

  return { register, isLoading, error, clearError: () => setError(null) };
}
