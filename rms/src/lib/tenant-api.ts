import { apiClient } from "./api-client";

// Business identity exposed to RMS staff. Sourced from the platform-auth
// `tenants` row — RMS staff can't edit any of it (that lives in the admin
// app), only read it for receipts and settings-page display.
export interface TenantInfoDto {
  id: string;
  name: string;
  pan: string | null;
  is_vat_registered: boolean;
  business_email: string | null;
  business_phone: string | null;
  business_address: string | null;
  logo_url: string | null;
}

export const tenantApi = {
  info() {
    return apiClient.get<TenantInfoDto>("/restro/tenant-info");
  },
};
