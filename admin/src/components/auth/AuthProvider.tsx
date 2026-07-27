'use client';

import { ReactNode, useEffect, useState } from 'react';
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

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Spinner size="lg" />
      </div>
    );
  }

  return <>{children}</>;
}
