'use client';

import { useEffect, useState, useCallback } from 'react';
import { appsApi } from '@/services/apps-api';
import { App } from '@/types/apps';
import { ApiError } from '@/types/auth';

export function useApps() {
  const [apps, setApps] = useState<App[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchApps = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await appsApi.listApps();
      setApps(response.data || []);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  return { apps, isLoading, error, refetch: fetchApps };
}

export function useAppDetail(slug: string) {
  const [app, setApp] = useState<App | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchApp = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await appsApi.getApp(slug);
      setApp(response.data || null);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (slug) fetchApp();
  }, [slug, fetchApp]);

  return { app, isLoading, error, refetch: fetchApp };
}
