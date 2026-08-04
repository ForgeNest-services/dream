import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import { authApi } from '@/services/auth-api';
import { BusinessRegisterRequest, BusinessRegisterResponse } from '@/types/api';
import { ApiError } from '@/types/auth';

export function useBusinessRegister() {
  const { setTenant, setTokens, setUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const register = async (data: BusinessRegisterRequest): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await authApi.businessRegister(data);
      const responseData = response.data as BusinessRegisterResponse;

      if (responseData?.tokens) {
        setTokens(responseData.tokens);
      }
      if (responseData?.user) {
        setUser(responseData.user, 'user');
      }
      if (responseData?.tenant) {
        setTenant(responseData.tenant);
      }

      toast.success('Business set up. Your apps are ready.');
      return true;
    } catch (err) {
      const apiErr = err as ApiError;
      const code = apiErr?.code;
      if (code === 'PAN_ALREADY_REGISTERED') {
        toast.error('This PAN is already registered under another account.');
      } else if (code === 'BUSINESS_EMAIL_ALREADY_REGISTERED') {
        toast.error('This business email is already registered under another account.');
      } else if (code === 'BUSINESS_PHONE_ALREADY_REGISTERED') {
        toast.error('This business phone is already registered under another account.');
      } else {
        toast.error(apiErr?.message || 'Could not save your business details.');
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return { register, isLoading };
}
