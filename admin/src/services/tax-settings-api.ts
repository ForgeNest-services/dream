import axiosClient from '@/lib/axios-client';
import { logger } from '@/lib/logger';
import { ApiResponse } from '@/types/api';
import { ApiError } from '@/types/auth';

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

export interface TaxSettingsData {
  pan: string | null;
  ird_username: string | null;
  ird_password_set: boolean;
  cbms_sync_enabled: boolean;
  consent_acknowledged_at: string | null;
  credentials_updated_at: string | null;
}

export interface CbmsSyncSummary {
  pending: number;
  failed: number;
  last_synced_at: string | null;
}

export interface TaxSettingsResponse {
  settings: TaxSettingsData;
  sync_summary: CbmsSyncSummary;
}

export interface SyncLogEntry {
  id: string;
  source_app: 'ims' | 'restro';
  document_type: 'invoice' | 'credit_note';
  document_id: string;
  document_number: string | null;
  status: 'pending' | 'synced' | 'failed';
  cbms_response_code: string | null;
  attempt_count: number;
  last_attempted_at: string | null;
  synced_at: string | null;
}

export const taxSettingsApi = {
  get: async (): Promise<ApiResponse<TaxSettingsResponse>> => {
    try {
      const response = await axiosClient.get<ApiResponse<TaxSettingsResponse>>('/tax-settings');
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'getTaxSettings');
    }
  },

  saveCredentials: async (data: {
    ird_username: string;
    ird_password: string;
    consent: boolean;
  }): Promise<ApiResponse<{ saved: boolean }>> => {
    try {
      const response = await axiosClient.put<ApiResponse<{ saved: boolean }>>(
        '/tax-settings/credentials',
        data
      );
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'saveTaxCredentials');
    }
  },

  setSyncEnabled: async (
    enabled: boolean
  ): Promise<ApiResponse<{ cbms_sync_enabled: boolean }>> => {
    try {
      const response = await axiosClient.patch<ApiResponse<{ cbms_sync_enabled: boolean }>>(
        '/tax-settings/sync-enabled',
        { enabled }
      );
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'setSyncEnabled');
    }
  },

  listSyncLog: async (params: {
    app?: 'ims' | 'restro';
    status?: 'pending' | 'synced' | 'failed';
    page?: number;
    per_page?: number;
  }): Promise<ApiResponse<SyncLogEntry[]>> => {
    try {
      const response = await axiosClient.get<ApiResponse<SyncLogEntry[]>>('/tax-settings/sync-log', {
        params,
      });
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'listSyncLog');
    }
  },

  resyncOne: async (logId: string): Promise<ApiResponse<{ status: string }>> => {
    try {
      const response = await axiosClient.post<ApiResponse<{ status: string }>>(
        `/tax-settings/sync-log/${logId}/resync`
      );
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'resyncOne');
    }
  },

  resyncAllFailed: async (
    app?: 'ims' | 'restro'
  ): Promise<ApiResponse<{ enqueued: number }>> => {
    try {
      const response = await axiosClient.post<ApiResponse<{ enqueued: number }>>(
        '/tax-settings/sync-log/resync-failed',
        {},
        { params: app ? { app } : undefined }
      );
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'resyncAllFailed');
    }
  },
};
