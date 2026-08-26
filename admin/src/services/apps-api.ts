import axiosClient from '@/lib/axios-client';
import { logger } from '@/lib/logger';
import { ApiResponse } from '@/types/api';
import { ApiError } from '@/types/auth';
import {
  App,
  AppCredential,
  CreateCredentialPayload,
  UpdateCredentialPayload,
  Branch,
  CreateBranchPayload,
  UpdateBranchPayload,
  APP_CODE_TO_API_PREFIX,
  SubscriptionPlan,
  UpdatePlanPayload,
  AdminSubscription,
  PaymentGroup,
  PriceQuote,
  OwnerUser,
  ManuallyActivatePayload,
} from '@/types/apps';

const normalizeError = (error: any, context?: string): ApiError => {
  if (error.response?.data) {
    const data = error.response.data;
    const apiError = {
      code: data.error?.code || 'UNKNOWN_ERROR',
      message: data.error?.message || data.message || 'An error occurred',
      statusCode: error.response.status,
      details: data.details,
    };
    logger.error(`API Error${context ? ` [${context}]` : ''}:`, apiError);
    return apiError;
  }
  return {
    code: 'NETWORK_ERROR',
    message: error.message || 'Network error occurred',
    statusCode: error.response?.status || 500,
  };
};

function credentialsPrefix(appCode: string): string {
  const prefix = APP_CODE_TO_API_PREFIX[appCode];
  if (!prefix) throw new Error(`No API prefix mapped for app code '${appCode}'`);
  return prefix;
}

export const appsApi = {
  listApps: async (): Promise<ApiResponse<App[]>> => {
    try {
      const response = await axiosClient.get<ApiResponse<App[]>>('/apps');
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'listApps');
    }
  },

  getApp: async (slug: string): Promise<ApiResponse<App>> => {
    try {
      const response = await axiosClient.get<ApiResponse<App>>(`/apps/${slug}`);
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'getApp');
    }
  },

  listCredentials: async (appCode: string): Promise<ApiResponse<AppCredential[]>> => {
    try {
      const response = await axiosClient.get<ApiResponse<AppCredential[]>>(
        `${credentialsPrefix(appCode)}/credentials`,
      );
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'listCredentials');
    }
  },

  createCredential: async (
    appCode: string,
    payload: CreateCredentialPayload,
  ): Promise<ApiResponse<AppCredential>> => {
    try {
      const response = await axiosClient.post<ApiResponse<AppCredential>>(
        `${credentialsPrefix(appCode)}/credentials`,
        payload,
      );
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'createCredential');
    }
  },

  updateCredential: async (
    appCode: string,
    credId: string,
    payload: UpdateCredentialPayload,
  ): Promise<ApiResponse<AppCredential>> => {
    try {
      const response = await axiosClient.patch<ApiResponse<AppCredential>>(
        `${credentialsPrefix(appCode)}/credentials/${credId}`,
        payload,
      );
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'updateCredential');
    }
  },

  deleteCredential: async (
    appCode: string,
    credId: string,
  ): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      const response = await axiosClient.delete<ApiResponse<{ deleted: boolean }>>(
        `${credentialsPrefix(appCode)}/credentials/${credId}`,
      );
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'deleteCredential');
    }
  },

  // Branches are tenant-level (shared across all apps), not app-scoped.
  listBranches: async (): Promise<ApiResponse<Branch[]>> => {
    try {
      const response = await axiosClient.get<ApiResponse<Branch[]>>("/branches");
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'listBranches');
    }
  },

  createBranch: async (payload: CreateBranchPayload): Promise<ApiResponse<Branch>> => {
    try {
      const response = await axiosClient.post<ApiResponse<Branch>>("/branches", payload);
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'createBranch');
    }
  },

  updateBranch: async (
    branchId: string,
    payload: UpdateBranchPayload,
  ): Promise<ApiResponse<Branch>> => {
    try {
      const response = await axiosClient.patch<ApiResponse<Branch>>(
        `/branches/${branchId}`,
        payload,
      );
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'updateBranch');
    }
  },

  deleteBranch: async (branchId: string): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      const response = await axiosClient.delete<ApiResponse<{ deleted: boolean }>>(
        `/branches/${branchId}`,
      );
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'deleteBranch');
    }
  },

  listMySubscriptions: async (): Promise<ApiResponse<import('@/types/apps').AppSubscription[]>> => {
    try {
      const response = await axiosClient.get('/subscriptions/my');
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'listMySubscriptions');
    }
  },

  listMyPayments: async (): Promise<ApiResponse<import('@/types/apps').SubscriptionPayment[]>> => {
    try {
      const response = await axiosClient.get('/subscriptions/my/payments');
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'listMyPayments');
    }
  },

  submitPayment: async (
    payload: import('@/types/apps').SubmitPaymentPayload,
  ): Promise<ApiResponse<{ group_id: string; payments: import('@/types/apps').SubscriptionPayment[] }>> => {
    try {
      const response = await axiosClient.post('/subscriptions/my/payments', payload);
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'submitPayment');
    }
  },

  listPlans: async (appCode?: string): Promise<ApiResponse<SubscriptionPlan[]>> => {
    try {
      const params = appCode ? { app_code: appCode } : {};
      const response = await axiosClient.get<ApiResponse<SubscriptionPlan[]>>('/subscriptions/plans', { params });
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'listPlans');
    }
  },

  getBundleDiscount: async (): Promise<ApiResponse<{ percent: string }>> => {
    try {
      const response = await axiosClient.get<ApiResponse<{ percent: string }>>('/subscriptions/bundle-discount');
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'getBundleDiscount');
    }
  },

  quotePrice: async (appCodes: string[], plan: 'monthly' | 'yearly'): Promise<ApiResponse<PriceQuote>> => {
    try {
      const response = await axiosClient.post<ApiResponse<PriceQuote>>('/subscriptions/quote', {
        app_codes: appCodes,
        plan,
      });
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'quotePrice');
    }
  },

  // ── Superadmin ──────────────────────────────────────────────────────────

  adminListPlans: async (): Promise<ApiResponse<SubscriptionPlan[]>> => {
    try {
      const response = await axiosClient.get<ApiResponse<SubscriptionPlan[]>>('/subscriptions/admin/plans');
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'adminListPlans');
    }
  },

  adminUpdatePlan: async (planId: string, payload: UpdatePlanPayload): Promise<ApiResponse<SubscriptionPlan>> => {
    try {
      const response = await axiosClient.patch<ApiResponse<SubscriptionPlan>>(
        `/subscriptions/admin/plans/${planId}`,
        payload,
      );
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'adminUpdatePlan');
    }
  },

  adminListAllSubscriptions: async (): Promise<ApiResponse<AdminSubscription[]>> => {
    try {
      const response = await axiosClient.get<ApiResponse<AdminSubscription[]>>('/subscriptions/admin/all');
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'adminListAllSubscriptions');
    }
  },

  adminListPendingPayments: async (): Promise<ApiResponse<PaymentGroup[]>> => {
    try {
      const response = await axiosClient.get<ApiResponse<PaymentGroup[]>>('/subscriptions/admin/pending-payments');
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'adminListPendingPayments');
    }
  },

  adminListAllPayments: async (): Promise<ApiResponse<PaymentGroup[]>> => {
    try {
      const response = await axiosClient.get<ApiResponse<PaymentGroup[]>>('/subscriptions/admin/all-payments');
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'adminListAllPayments');
    }
  },

  adminConfirmPaymentGroup: async (groupId: string, notes?: string): Promise<ApiResponse<unknown>> => {
    try {
      const response = await axiosClient.post(`/subscriptions/admin/payment-groups/${groupId}/confirm`, { notes: notes ?? null });
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'adminConfirmPaymentGroup');
    }
  },

  adminRejectPaymentGroup: async (groupId: string, notes?: string): Promise<ApiResponse<unknown>> => {
    try {
      const response = await axiosClient.post(`/subscriptions/admin/payment-groups/${groupId}/reject`, { notes: notes ?? null });
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'adminRejectPaymentGroup');
    }
  },

  adminUpdateBundleDiscount: async (percent: number): Promise<ApiResponse<{ percent: string }>> => {
    try {
      const response = await axiosClient.patch<ApiResponse<{ percent: string }>>('/subscriptions/admin/bundle-discount', { percent });
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'adminUpdateBundleDiscount');
    }
  },

  adminExtendTrial: async (tenantId: string, appCode: string, extraDays: number): Promise<ApiResponse<unknown>> => {
    try {
      const response = await axiosClient.post('/subscriptions/admin/extend-trial', {
        tenant_id: tenantId,
        app_code: appCode,
        extra_days: extraDays,
      });
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'adminExtendTrial');
    }
  },

  adminListUsers: async (): Promise<ApiResponse<OwnerUser[]>> => {
    try {
      const response = await axiosClient.get<ApiResponse<OwnerUser[]>>('/subscriptions/admin/users');
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'adminListUsers');
    }
  },

  adminActivateSubscription: async (payload: ManuallyActivatePayload): Promise<ApiResponse<unknown>> => {
    try {
      const response = await axiosClient.post('/subscriptions/admin/activate', payload);
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'adminActivateSubscription');
    }
  },
};
