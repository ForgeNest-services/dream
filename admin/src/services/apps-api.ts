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

  listBranches: async (appCode: string): Promise<ApiResponse<Branch[]>> => {
    try {
      const response = await axiosClient.get<ApiResponse<Branch[]>>(
        `${credentialsPrefix(appCode)}/branches`,
      );
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'listBranches');
    }
  },

  createBranch: async (
    appCode: string,
    payload: CreateBranchPayload,
  ): Promise<ApiResponse<Branch>> => {
    try {
      const response = await axiosClient.post<ApiResponse<Branch>>(
        `${credentialsPrefix(appCode)}/branches`,
        payload,
      );
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'createBranch');
    }
  },

  updateBranch: async (
    appCode: string,
    branchId: string,
    payload: UpdateBranchPayload,
  ): Promise<ApiResponse<Branch>> => {
    try {
      const response = await axiosClient.patch<ApiResponse<Branch>>(
        `${credentialsPrefix(appCode)}/branches/${branchId}`,
        payload,
      );
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'updateBranch');
    }
  },

  deleteBranch: async (
    appCode: string,
    branchId: string,
  ): Promise<ApiResponse<{ deleted: boolean }>> => {
    try {
      const response = await axiosClient.delete<ApiResponse<{ deleted: boolean }>>(
        `${credentialsPrefix(appCode)}/branches/${branchId}`,
      );
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'deleteBranch');
    }
  },
};
