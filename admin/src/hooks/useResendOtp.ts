import { useState } from 'react';
import { toast } from 'sonner';
import { authApi } from '@/services/auth-api';
import { ApiError } from '@/types/auth';

interface ResendResult {
  ok: boolean;
  expiresIn?: number;
}

export function useResendOtp() {
  const [isLoading, setIsLoading] = useState(false);

  const resend = async (email: string): Promise<ResendResult> => {
    setIsLoading(true);
    try {
      const response = await authApi.resendOtp({ email });
      const expiresIn = (response.data as { otp_expires_in?: number })?.otp_expires_in;
      toast.success('A new code was sent to your email.');
      return { ok: true, expiresIn };
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr?.code === 'ALREADY_VERIFIED') {
        toast.info('This email is already verified. You can sign in.');
      } else if (apiErr?.code === 'USER_NOT_FOUND') {
        toast.error('No account found for that email.');
      } else {
        toast.error(apiErr?.message || 'Could not resend the code.');
      }
      return { ok: false };
    } finally {
      setIsLoading(false);
    }
  };

  return { resend, isLoading };
}
