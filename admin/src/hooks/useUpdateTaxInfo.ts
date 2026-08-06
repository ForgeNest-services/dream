import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import { authApi } from '@/services/auth-api';
import { UpdateTaxInfoRequest } from '@/types/api';
import { ApiError } from '@/types/auth';

export function useUpdateTaxInfo() {
  const { setTenant } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const update = async (data: UpdateTaxInfoRequest): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await authApi.updateTaxInfo(data);
      if (response.data?.tenant) {
        setTenant(response.data.tenant);
      }
      toast.success('Tax registration updated');
      return true;
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.code === 'PAN_ALREADY_REGISTERED') {
        toast.error('This PAN is already registered under another account.');
      } else {
        toast.error(apiErr?.message || 'Could not update tax registration.');
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return { update, isLoading };
}
