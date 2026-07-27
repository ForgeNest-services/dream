import { TokenData } from '@/types/auth';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'auth_access_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  TOKEN_TYPE: 'auth_token_type',
};

export const authStorage = {
  getTokens: (): TokenData | null => {
    if (typeof window === 'undefined') return null;

    const access_token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const refresh_token = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    const token_type = localStorage.getItem(STORAGE_KEYS.TOKEN_TYPE) || 'bearer';

    if (!access_token || !refresh_token) return null;

    return { access_token, refresh_token, token_type };
  },

  setTokens: (tokens: TokenData): void => {
    if (typeof window === 'undefined') return;

    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.access_token);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh_token);
    localStorage.setItem(STORAGE_KEYS.TOKEN_TYPE, tokens.token_type || 'bearer');
  },

  clearTokens: (): void => {
    if (typeof window === 'undefined') return;

    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.TOKEN_TYPE);
  },

  getAccessToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  },

  getRefreshToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  },

  decodeToken: (token: string): Record<string, unknown> | null => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  },

  isTokenExpired: (token: string): boolean => {
    const decoded = authStorage.decodeToken(token);
    if (!decoded || !decoded.exp) return true;

    const expiryTime = (decoded.exp as number) * 1000;
    const currentTime = Date.now();
    const bufferTime = 60 * 1000; // 1 minute buffer

    return currentTime >= expiryTime - bufferTime;
  },
};
