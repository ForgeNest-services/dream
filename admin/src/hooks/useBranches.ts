'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { appsApi } from '@/services/apps-api';
import { Branch, CreateBranchPayload, UpdateBranchPayload } from '@/types/apps';
import { ApiError } from '@/types/auth';

// Branches are tenant-level (shared across all apps) — no appCode needed.
export function useBranches(enabled: boolean = true) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isMutating, setIsMutating] = useState(false);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await appsApi.listBranches();
      setBranches(response.data || []);
    } catch (err) {
      const apiErr = err as ApiError;
      toast.error(apiErr.message || 'Failed to load branches');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Superadmins have no tenant_id, so GET /branches (require_tenant_scope)
    // 401s for them — with no working /auth/refresh endpoint on the backend,
    // any 401 wipes valid tokens and force-redirects to login. Never call
    // this for a superadmin session (see DashboardContent's isSuperAdmin gate).
    if (enabled) fetch();
  }, [enabled, fetch]);

  const create = async (payload: CreateBranchPayload): Promise<boolean> => {
    setIsMutating(true);
    try {
      await appsApi.createBranch(payload);
      toast.success('Branch created');
      await fetch();
      return true;
    } catch (err) {
      const apiErr = err as ApiError;
      toast.error(apiErr.message || 'Failed to create branch');
      return false;
    } finally {
      setIsMutating(false);
    }
  };

  const update = async (branchId: string, payload: UpdateBranchPayload): Promise<boolean> => {
    setIsMutating(true);
    try {
      await appsApi.updateBranch(branchId, payload);
      toast.success('Branch updated');
      await fetch();
      return true;
    } catch (err) {
      const apiErr = err as ApiError;
      toast.error(apiErr.message || 'Failed to update branch');
      return false;
    } finally {
      setIsMutating(false);
    }
  };

  const remove = async (branchId: string): Promise<boolean> => {
    setIsMutating(true);
    try {
      await appsApi.deleteBranch(branchId);
      toast.success('Branch removed');
      await fetch();
      return true;
    } catch (err) {
      const apiErr = err as ApiError;
      toast.error(apiErr.message || 'Failed to delete branch');
      return false;
    } finally {
      setIsMutating(false);
    }
  };

  return { branches, isLoading, isMutating, refetch: fetch, create, update, remove };
}
