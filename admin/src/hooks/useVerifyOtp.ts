import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import { authApi } from '@/services/auth-api';
import { VerifyOTPRequest, VerifyOTPResponse } from '@/types/api';
import { ApiError } from '@/types/auth';

export function useVerifyOtp() {
  const router = useRouter();
  const { setTokens, setUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const verify = async (data: VerifyOTPRequest): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await authApi.verifyOtp(data);
      const responseData = response.data as VerifyOTPResponse;

      if (!responseData?.tokens || !responseData?.user) {
        toast.error('Verification succeeded but response was incomplete.');
        return false;
      }

      setTokens(responseData.tokens);
      setUser({ ...responseData.user, role: responseData.user.role || 'owner' }, 'user');

      toast.success('Email verified. Welcome!');
      router.push('/dashboard');
      return true;
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr?.code === 'INVALID_OTP') {
        toast.error('Incorrect or expired code. Try again or resend a new one.');
      } else if (apiErr?.code === 'ALREADY_VERIFIED') {
        toast.info('Email already verified. Please sign in.');
      } else {
        toast.error(apiErr?.message || 'Could not verify the code.');
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return { verify, isLoading };
}
