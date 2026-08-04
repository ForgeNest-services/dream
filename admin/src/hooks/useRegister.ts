import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import { authApi } from '@/services/auth-api';
import { RegisterRequest, RegisterResponse } from '@/types/api';
import { ApiError } from '@/types/auth';

interface RegisterResult {
  ok: boolean;
  otpExpiresIn?: number;
}

export function useRegister() {
  const { setUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const register = async (data: RegisterRequest): Promise<RegisterResult> => {
    setIsLoading(true);
    try {
      const response = await authApi.register(data);
      const responseData = response.data as RegisterResponse & { otp_expires_in?: number };
      if (!responseData?.user) {
        throw new Error('Invalid response from server');
      }
      setUser(responseData.user, 'user');

      toast.success('Account created — check your email for the code.');
      return { ok: true, otpExpiresIn: responseData.otp_expires_in };
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr?.code === 'EMAIL_ALREADY_EXISTS') {
        toast.error('This email is already registered. Sign in instead.');
      } else {
        toast.error(apiErr?.message || 'Registration failed');
      }
      return { ok: false };
    } finally {
      setIsLoading(false);
    }
  };

  return { register, isLoading };
}
