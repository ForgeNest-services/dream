import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Tenant, TokenData, AuthState, PlatformAdmin } from '@/types/auth';
import { authStorage } from '@/lib/auth-storage';
import { authApi } from '@/services/auth-api';

interface AuthStore extends AuthState {
  setUser: (user: User | PlatformAdmin | null, userType?: 'user' | 'superadmin') => void;
  setUserType: (userType: 'user' | 'superadmin' | null) => void;
  setTenant: (tenant: Tenant | null) => void;
  setTokens: (tokens: TokenData | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setAuthenticated: (authenticated: boolean) => void;

  hydrate: () => Promise<void>;
  logout: () => void;
  clearError: () => void;
  setAuthError: (message: string) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      userType: null,
      tenant: null,
      tokens: null,
      isLoading: false,
      error: null,
      isAuthenticated: false,

      setUser: (user, userType) => set({ user, userType: userType || null }),
      setUserType: (userType) => set({ userType }),
      setTenant: (tenant) => set({ tenant }),
      setTokens: (tokens) => {
        if (tokens) {
          authStorage.setTokens(tokens);
        }
        set({ tokens, isAuthenticated: !!tokens });
      },
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),

      hydrate: async () => {
        const tokens = authStorage.getTokens();

        if (!tokens) {
          set({ isAuthenticated: false, user: null, tenant: null, tokens: null });
          return;
        }

        // Check if access token is expired
        if (authStorage.isTokenExpired(tokens.access_token)) {
          authStorage.clearTokens();
          set({ isAuthenticated: false, user: null, tenant: null, tokens: null });
          return;
        }

        set({ tokens, isAuthenticated: true });

        // Fetch current user
        try {
          const response = await authApi.getCurrentUser();
          if (response.success && response.data) {
            const userData = response.data;

            if (userData.is_superadmin) {
              // Superadmin user
              set({
                user: {
                  id: userData.id,
                  email: userData.email,
                  is_active: true,
                } as PlatformAdmin,
                userType: 'superadmin',
                isAuthenticated: true,
              });
            } else {
              // Regular user
              set({
                user: {
                  id: userData.id,
                  email: userData.email,
                  full_name: userData.full_name || '',
                  is_owner: userData.full_name ? false : true,
                  tenant_id: userData.tenant_id || null,
                  role: userData.role || 'owner',
                  picture_url: userData.picture_url,
                } as User,
                userType: 'user',
                tenant: userData.tenant || null,
                isAuthenticated: true,
              });
            }
          }
        } catch (error) {
          authStorage.clearTokens();
          set({ isAuthenticated: false, user: null, userType: null, tenant: null, tokens: null });
        }
      },

      logout: () => {
        // IRD: fire-and-forget — records the logout event server-side
        // (clause 6.3ख). Called before clearing tokens since the endpoint
        // is authenticated; a failure here shouldn't block the actual
        // logout.
        void authApi.logout();
        authStorage.clearTokens();
        set({
          user: null,
          userType: null,
          tenant: null,
          tokens: null,
          isAuthenticated: false,
          error: null,
        });
      },

      clearError: () => set({ error: null }),
      setAuthError: (message: string) => set({ error: message }),
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        tokens: state.tokens,
        user: state.user ? { id: (state.user as any).id, email: (state.user as any).email } : null,
      }),
    }
  )
);
