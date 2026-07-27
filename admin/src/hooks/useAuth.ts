import { useAuthStore } from '@/store/auth-store';

export function useAuth() {
  const user = useAuthStore((state) => state.user);
  const userType = useAuthStore((state) => state.userType);
  const tenant = useAuthStore((state) => state.tenant);
  const tokens = useAuthStore((state) => state.tokens);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const setUser = useAuthStore((state) => state.setUser);
  const setUserType = useAuthStore((state) => state.setUserType);
  const setTenant = useAuthStore((state) => state.setTenant);
  const setTokens = useAuthStore((state) => state.setTokens);
  const setLoading = useAuthStore((state) => state.setLoading);
  const setError = useAuthStore((state) => state.setError);
  const logout = useAuthStore((state) => state.logout);
  const clearError = useAuthStore((state) => state.clearError);
  const setAuthError = useAuthStore((state) => state.setAuthError);

  // Get role directly from API response
  const userRole = user && 'role' in user ? user.role : null;
  const isSuperAdmin = userType === 'superadmin';
  const isOwner = userRole === 'owner';
  const isManager = userRole === 'manager';

  return {
    user,
    userType,
    tenant,
    tokens,
    isLoading,
    error,
    isAuthenticated,
    userRole,
    isSuperAdmin,
    isOwner,
    isManager,
    setUser,
    setUserType,
    setTenant,
    setTokens,
    setLoading,
    setError,
    logout,
    clearError,
    setAuthError,
  };
}
