import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import { authApi } from '@/services/auth-api';
import { LoginRequest, LoginResponse, SuperadminLoginResponse } from '@/types/api';
import { ApiError, PlatformAdmin } from '@/types/auth';

export function useLogin() {
  const router = useRouter();
  const { setUser, setTenant, setTokens } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const login = async (data: LoginRequest): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await authApi.login(data);
      const responseData = response.data as LoginResponse | SuperadminLoginResponse;

      if ('is_superadmin' in responseData) {
        const adminResponse = responseData as SuperadminLoginResponse;
        setTokens(adminResponse.tokens);
        setTenant(null);
        setUser(
          { id: adminResponse.admin_id, is_active: true } as PlatformAdmin,
          'superadmin',
        );
      } else {
        const userResponse = responseData as LoginResponse;
        setTokens(userResponse.tokens);
        setUser(userResponse.user, 'user');
        setTenant(userResponse.tenant ?? null);
      }

      toast.success('Signed in successfully');
      router.push('/dashboard');
      return true;
    } catch (err) {
      const apiErr = err as ApiError;
      const code = apiErr?.code || 'LOGIN_FAILED';

      if (code === 'USER_NOT_FOUND') {
        toast.error('No account found with this email. Please register first.');
      } else if (code === 'EMAIL_NOT_VERIFIED') {
        toast.warning('Please verify your email before logging in.');
      } else if (code === 'INVALID_CREDENTIALS') {
        toast.error('Incorrect password. Please try again.');
      } else {
        toast.error(apiErr?.message || 'Login failed');
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return { login, isLoading };
}
