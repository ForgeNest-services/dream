'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/shared/Spinner';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: string[];
}

export function ProtectedRoute({ children, requiredRoles = [] }: ProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated, userRole, isSuperAdmin } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
      return;
    }

    if (requiredRoles.length > 0) {
      const hasRequiredRole = isSuperAdmin || requiredRoles.includes(userRole || '');
      if (!hasRequiredRole) {
        router.push('/dashboard');
      }
    }
  }, [isAuthenticated, userRole, isSuperAdmin, requiredRoles, router]);

  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return <>{children}</>;
}
