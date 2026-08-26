'use client';

import { ReactNode, useEffect, useState } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { useAuthStore } from '@/store/auth-store';
import { Spinner } from '@/components/shared/Spinner';
import { logger } from '@/lib/logger';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    const initAuth = async () => {
      try {
        logger.debug('Starting auth hydration...');
        await hydrate();
        logger.debug('Auth hydration completed');
        setIsHydrated(true);
      } catch (error) {
        logger.error('Auth hydration failed:', error);
        setIsHydrated(true);
      }
    };

    initAuth();
  }, [hydrate]);

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!isHydrated) {
    return (
      <div
        style={{
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8fafc',
        }}
      >
        <Spinner size="lg" />
      </div>
    );
  }

  if (!googleClientId) {
    logger.warn('Google Client ID not configured in environment');
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId || 'placeholder'}>
      {children}
    </GoogleOAuthProvider>
  );
}
