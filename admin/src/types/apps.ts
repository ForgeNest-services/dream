export interface App {
  id: string;
  code: string;
  slug: string;
  name: string;
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

export const APP_CODE_TO_ROLES: Record<string, ReadonlyArray<{ code: string; label: string }>> = {
  srota_pms: HOTEL_PMS_ROLES,
  srota_rms: RESTRO_ROLES,
  srota_ims: IMS_ROLES,
};
