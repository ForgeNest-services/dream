import { User, Tenant, TokenData } from './auth';

export interface RegisterRequest {
  full_name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface VerifyOTPRequest {
  email: string;
  otp_code: string;
}

export interface ResendOTPRequest {
  email: string;
}

export interface BusinessRegisterRequest {
  business_name: string;
  business_address: string;
  pan?: string | null;
  business_phone?: string | null;
  business_email?: string | null;
}

export interface GoogleCallbackRequest {
  id_token: string;
}

export interface GoogleCompleteRequest {
  email: string;
  full_name: string;
  business_name?: string;
  business_address?: string;
  pan?: string | null;
  picture_url?: string | null;
  business_phone?: string | null;
  business_email?: string | null;
}

export interface CreateTeamMemberRequest {
  email: string;
  full_name: string;
  role: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
  details?: Record<string, unknown>;
}

export interface LoginResponse {
  user: User;
  tenant?: Tenant | null;
  tokens: TokenData;
}

export interface SuperadminLoginResponse {
  admin_id: string;
  is_superadmin: true;
  tokens: TokenData;
}

export interface RegisterResponse {
  user: User;
}

export interface VerifyOTPResponse {
  user: User;
  tokens: TokenData;
}

export interface BusinessRegisterResponse {
  user: User;
  tenant: Tenant;
  tokens: TokenData;
}

export interface GoogleCallbackResponse {
  user_exists: boolean;
  email: string;
  name?: string | null;
  picture?: string | null;
  user?: User;
  tenant?: Tenant | null;
  tokens?: TokenData;
}

export interface MeResponse {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
  picture_url?: string | null;
  tenant_id?: string | null;
  tenant?: {
    id: string;
    name: string;
    pan?: string | null;
    business_address?: string | null;
    business_phone?: string | null;
    business_email?: string | null;
  };
  is_superadmin?: boolean;
}
