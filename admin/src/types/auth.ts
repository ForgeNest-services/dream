export interface User {
  id: string;
  full_name: string;
  email: string;
  is_owner: boolean;
  tenant_id: string | null;
  role: string; // owner, manager, staff, accountant
  picture_url?: string | null;
  is_verified?: boolean;
  is_active?: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  pan?: string | null;
  is_vat_registered: boolean;
  business_address?: string | null;
  business_phone?: string | null;
  business_email?: string | null;
  free_app_code?: string | null;
}

export interface TokenData {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface PlatformAdmin {
  id: string;
  email?: string;
  is_active: boolean;
}

export interface AuthState {
  user: User | PlatformAdmin | null;
  userType: 'user' | 'superadmin' | null; // Explicitly store the user type from API
  tenant: Tenant | null;
  tokens: TokenData | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
}
