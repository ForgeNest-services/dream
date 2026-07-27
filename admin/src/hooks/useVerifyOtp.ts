import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './useAuth';
import { authApi } from '@/services/auth-api';
import { VerifyOTPRequest, VerifyOTPResponse } from '@/types/api';
import { ApiError } from '@/types/auth';
import { logger } from '@/lib/logger';

export function useVerifyOtp() {
  const router = useRouter();
  const { setTokens, setUser, setUserType, setAuthError } = useAuth();
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const verify = async (data: VerifyOTPRequest): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await authApi.verifyOtp(data);

      if (!response.success) {
        const errorMsg = response.error?.message || 'Verification failed';
        setError({
          code: response.error?.code || 'VERIFICATION_FAILED',
          message: errorMsg,
          statusCode: 400,
        });
        setAuthError(errorMsg);
        return false;
      }

      const responseData = response.data as VerifyOTPResponse;

      logger.debug('OTP Verification Response:', responseData);

      setTokens(responseData.tokens);

      // Ensure role is set, default to 'owner' if not provided
      const user = {
        ...responseData.user,
        role: responseData.user.role || 'owner',
      };
      logger.debug('User after verification:', user);
      setUser(user, 'user');

      // If user doesn't have tenant_id, they need to complete business registration
      if (!user.tenant_id) {
        logger.debug('No tenant_id, redirecting to business-register');
        router.push('/business-register');
      } else {
        logger.debug('Has tenant_id, redirecting to dashboard');
        router.push('/dashboard');
      }
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

  return { verify, isLoading, error, clearError: () => setError(null) };
}
