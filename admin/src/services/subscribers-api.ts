import axiosClient from '@/lib/axios-client';
import { logger } from '@/lib/logger';
import { ApiResponse } from '@/types/api';
import { ApiError } from '@/types/auth';
import { SubscriberItem } from '@/types/subscribers';

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

export const subscribersApi = {
  adminList: async (page = 1, perPage = 25): Promise<ApiResponse<SubscriberItem[]>> => {
    try {
      const response = await axiosClient.get<ApiResponse<SubscriberItem[]>>('/subscribers/admin', {
        params: { page, per_page: perPage },
      });
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'adminListSubscribers');
    }
  },
};
