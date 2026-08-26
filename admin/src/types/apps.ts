export interface App {
  id: string;
  code: string;
  slug: string;
  name: string;
  tagline?: string | null;
  description?: string | null;
  // Legacy react-icons name (e.g. "Hotel", "Restaurant"). Kept as a fallback
  // when icon_url isn't set.
  icon?: string | null;
  // Public MinIO URL of the app's logo/icon PNG. Preferred over the icon-name
  // fallback when both are present.
  icon_url?: string | null;
  url: string;
  is_active: boolean;
}

export interface AppCredential {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  role: string;
  username: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCredentialPayload {
  role: string;
  username: string;
  password: string;
  branch_id?: string | null;
}

export interface UpdateCredentialPayload {
  username?: string;
  password?: string;
}

export interface Branch {
  id: string;
  tenant_id: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateBranchPayload {
  name: string;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
}

export interface UpdateBranchPayload {
  name?: string;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
}

export const BRANCH_SCOPED_ROLES = new Set([
  'manager',
  'front_desk',
  'waiter',
  'chef',
  'storekeeper',
]);

export const HOTEL_PMS_ROLES = [
  { code: 'app_owner', label: 'App Owner' },
  { code: 'manager', label: 'Manager' },
  { code: 'front_desk', label: 'Front Desk' },
] as const;

export const RESTRO_ROLES = [
  { code: 'owner', label: 'Owner' },
  { code: 'manager', label: 'Manager' },
  { code: 'waiter', label: 'Waiter' },
  { code: 'chef', label: 'Chef' },
] as const;

export const IMS_ROLES = [
  { code: 'owner', label: 'Owner' },
  { code: 'manager', label: 'Manager' },
  { code: 'storekeeper', label: 'Store Keeper' },
] as const;

// Keyed on the display `code` stored in the apps catalog row (renamed to
// srota_pms / srota_rms / srota_ims during the Srota rebrand). The backend
// API prefixes intentionally stay /hotel-pms, /restro, /ims — those are the
// actual FastAPI router prefixes, unrelated to the display code.
export const APP_CODE_TO_API_PREFIX: Record<string, string> = {
  srota_pms: '/hotel-pms',
  srota_rms: '/restro',
  srota_ims: '/ims',
};

export interface AppSubscription {
  id: string;
  tenant_id: string;
  app_code: string;
  status: 'trialing' | 'active' | 'expired' | 'cancelled';
  plan: 'monthly' | 'yearly' | null;
  trial_ends_at: string | null;
  period_start: string | null;
  period_end: string | null;
  price_npr: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPayment {
  id: string;
  group_id: string;
  tenant_id: string;
  app_code: string;
  amount_npr: string;
  plan: string;
  period_months: number;
  payment_method: string | null;
  status: 'pending' | 'confirmed' | 'rejected';
  notes: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** One purchase request — a single app is a group of one row; a bundle
 *  purchase (2+ apps bought together at a discount) is N rows sharing one
 *  group_id, each carrying that app's discounted share of the total. */
export interface PaymentGroup {
  group_id: string;
  tenant_id: string;
  tenant_name: string;
  plan: string;
  status: 'pending' | 'confirmed' | 'rejected';
  payment_method: string | null;
  created_at: string;
  payments: SubscriptionPayment[];
}

export interface SubmitPaymentPayload {
  app_codes: string[];
  plan: 'monthly' | 'yearly';
  payment_method?: string | null;
  notes?: string | null;
}

export interface PriceQuoteLine {
  app_code: string;
  amount_npr: string;
}

export interface PriceQuote {
  lines: PriceQuoteLine[];
  subtotal_npr: string;
  discount_percent: string;
  discount_amount_npr: string;
  total_npr: string;
}

export const APP_CODE_TO_ROLES: Record<string, ReadonlyArray<{ code: string; label: string }>> = {
  srota_pms: HOTEL_PMS_ROLES,
  srota_rms: RESTRO_ROLES,
  srota_ims: IMS_ROLES,
};

export interface SubscriptionPlan {
  id: string;
  app_code: string;
  plan: string;
  price_npr: string;
  label: string;
  is_active: boolean;
  updated_at: string;
}

export interface UpdatePlanPayload {
  price_npr?: number;
  label?: string;
  is_active?: boolean;
}

export interface AdminSubscription {
  id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_email: string | null;
  app_code: string;
  status: string;
  plan: string | null;
  trial_ends_at: string | null;
  period_start: string | null;
  period_end: string | null;
  price_npr: string | null;
  created_at: string;
  updated_at: string;
}

export interface OwnerTenant {
  id: string;
  name: string;
  pan: string | null;
  is_vat_registered: boolean;
  business_address: string | null;
  business_phone: string | null;
  business_email: string | null;
}

/** One row on the superadmin Users page. */
export interface OwnerUser {
  user_id: string;
  full_name: string;
  email: string;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  tenant: OwnerTenant | null;
  subscriptions: AppSubscription[];
}

export interface ManuallyActivatePayload {
  tenant_id: string;
  app_code: string;
  plan: 'monthly' | 'yearly';
  months: number;
  price_npr: number;
  notes?: string | null;
}
