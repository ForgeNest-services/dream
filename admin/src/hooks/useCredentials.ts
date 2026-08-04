'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { appsApi } from '@/services/apps-api';
import {
  AppCredential,
  CreateCredentialPayload,
  UpdateCredentialPayload,
} from '@/types/apps';
import { ApiError } from '@/types/auth';

export function useCredentials(appCode: string) {
  const [credentials, setCredentials] = useState<AppCredential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await appsApi.listCredentials(appCode);
      setCredentials(response.data || []);
    } catch (err) {
      const apiErr = err as ApiError;
      toast.error(apiErr.message || 'Failed to load credentials');
    } finally {
      setIsLoading(false);
    }
  }, [appCode]);

  useEffect(() => {
    if (appCode) fetch();
  }, [appCode, fetch]);

  const create = async (payload: CreateCredentialPayload): Promise<boolean> => {
    setIsMutating(true);
    try {
      await appsApi.createCredential(appCode, payload);
      toast.success(`Credential created for ${payload.role.replace('_', ' ')}`);
      await fetch();
      return true;
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.code === 'ROLE_ALREADY_HAS_CREDENTIAL') {
        toast.error(`A credential for '${payload.role}' already exists.`);
      } else if (apiErr.code === 'USERNAME_TAKEN') {
        toast.error('That username is already in use. Pick another.');
      } else {
        toast.error(apiErr.message || 'Failed to create credential');
      }
      return false;
    } finally {
      setIsMutating(false);
    }
  };

  const update = async (
    role: string,
    payload: UpdateCredentialPayload,
  ): Promise<boolean> => {
    setIsMutating(true);
    try {
      await appsApi.updateCredential(appCode, role, payload);
      toast.success('Credential updated');
      await fetch();
      return true;
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.code === 'USERNAME_TAKEN') {
        toast.error('That username is already in use.');
      } else {
        toast.error(apiErr.message || 'Failed to update credential');
      }
      return false;
    } finally {
      setIsMutating(false);
    }
  };

  const remove = async (role: string): Promise<boolean> => {
    setIsMutating(true);
    try {
      await appsApi.deleteCredential(appCode, role);
      toast.success('Credential removed');
      await fetch();
      return true;
    } catch (err) {
      const apiErr = err as ApiError;
      toast.error(apiErr.message || 'Failed to delete credential');
      return false;
    } finally {
      setIsMutating(false);
    }
  };

  return { credentials, isLoading, isMutating, refetch: fetch, create, update, remove };
}
