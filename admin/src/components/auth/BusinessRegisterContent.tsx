'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { BusinessRegisterForm } from './forms/BusinessRegisterForm';
import { Spinner } from '@/components/shared/Spinner';

export function BusinessRegisterContent() {
  const router = useRouter();
  const { isAuthenticated, isLoading, tenant } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (tenant) {
      router.push('/dashboard');
    }
  }, [tenant, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated || tenant) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Complete Your Registration
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Add your business details
          </p>
        </div>

        <BusinessRegisterForm />
      </div>
    </div>
  );
}
