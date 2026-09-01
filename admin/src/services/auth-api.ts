import axiosClient from '@/lib/axios-client';
import { logger } from '@/lib/logger';
import {
  RegisterRequest,
  LoginRequest,
  VerifyOTPRequest,
  ResendOTPRequest,
  BusinessRegisterRequest,
  UpdateTaxInfoRequest,
  GoogleCallbackRequest,
  GoogleCompleteRequest,
  LoginResponse,
  SuperadminLoginResponse,
  RegisterResponse,
  VerifyOTPResponse,
  BusinessRegisterResponse,
  GoogleCallbackResponse,
  MeResponse,
  ApiResponse,
} from '@/types/api';
import { ApiError, Tenant } from '@/types/auth';

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

  const networkError = {
    code: 'NETWORK_ERROR',
    message: error.message || 'Network error occurred',
    statusCode: error.response?.status || 500,
  };
  logger.error(`Network Error${context ? ` [${context}]` : ''}:`, networkError);
  return networkError;
};

export const authApi = {
  register: async (data: RegisterRequest): Promise<ApiResponse<RegisterResponse>> => {
    try {
      logger.debug('Registering user:', data.email);
      const response = await axiosClient.post<ApiResponse<RegisterResponse>>(
        '/auth/register',
        data
      );
      logger.info('User registered successfully:', data.email);
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'register');
    }
  },

  login: async (
    data: LoginRequest
  ): Promise<ApiResponse<LoginResponse | SuperadminLoginResponse>> => {
    try {
      logger.debug('Logging in user:', data.email);
      const response = await axiosClient.post<ApiResponse<LoginResponse | SuperadminLoginResponse>>(
        '/auth/login',
        data
      );
      logger.info('User logged in successfully:', data.email);
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'login');
    }
  },

  verifyOtp: async (data: VerifyOTPRequest): Promise<ApiResponse<VerifyOTPResponse>> => {
    try {
      const response = await axiosClient.post<ApiResponse<VerifyOTPResponse>>(
        '/auth/verify-otp',
        data
      );
      return response.data;
    } catch (error) {
      throw normalizeError(error);
    }
  },

  resendOtp: async (data: ResendOTPRequest): Promise<ApiResponse> => {
    try {
      const response = await axiosClient.post<ApiResponse>('/auth/resend-verification-otp', data);
      return response.data;
    } catch (error) {
      throw normalizeError(error);
    }
  },

  businessRegister: async (
    data: BusinessRegisterRequest
  ): Promise<ApiResponse<BusinessRegisterResponse>> => {
    try {
      logger.debug('Registering business:', data.business_name);
      const response = await axiosClient.post<ApiResponse<BusinessRegisterResponse>>(
        '/auth/business-register',
        data
      );
      logger.info('Business registered successfully:', data.business_name);
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'businessRegister');
    }
  },

  updateTaxInfo: async (
    data: UpdateTaxInfoRequest
  ): Promise<ApiResponse<{ tenant: Tenant }>> => {
    try {
      const response = await axiosClient.patch<ApiResponse<{ tenant: Tenant }>>(
        '/auth/business-tax-info',
        data
      );
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'updateTaxInfo');
    }
  },

  googleCallback: async (data: GoogleCallbackRequest): Promise<ApiResponse<GoogleCallbackResponse>> => {
    try {
      const response = await axiosClient.post<ApiResponse<GoogleCallbackResponse>>(
        '/auth/google/callback',
        data
      );
      return response.data;
    } catch (error) {
      throw normalizeError(error);
    }
  },

  googleComplete: async (
    data: GoogleCompleteRequest
  ): Promise<ApiResponse<BusinessRegisterResponse>> => {
    try {
      const response = await axiosClient.post<ApiResponse<BusinessRegisterResponse>>(
        '/auth/google/complete',
        data
      );
      return response.data;
    } catch (error) {
      throw normalizeError(error);
    }
  },

  getCurrentUser: async (): Promise<ApiResponse<MeResponse>> => {
    try {
      logger.debug('Fetching current user info');
      const response = await axiosClient.get<ApiResponse<MeResponse>>('/auth/me');
      logger.debug('Current user fetched successfully');
      return response.data;
    } catch (error) {
      throw normalizeError(error, 'getCurrentUser');
    }
  },

  refreshToken: async (refreshToken: string): Promise<ApiResponse> => {
    try {
      const response = await axiosClient.post<ApiResponse>('/auth/refresh', {
        refresh_token: refreshToken,
      });
      return response.data;
    } catch (error) {
      throw normalizeError(error);
    }
  },

  // IRD: Electronic Billing Procedure 2082, clause 6.3ख — records the
  // logout event server-side for the activity log. There's no session to
  // actually invalidate (access/refresh tokens aren't revocation-tracked),
  // so this is fire-and-forget from the caller's perspective.
  logout: async (): Promise<void> => {
    try {
      await axiosClient.post('/auth/logout');
    } catch {
      // Non-fatal — logout proceeds client-side regardless.
    }
  },
};
