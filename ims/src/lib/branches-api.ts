import { apiClient } from "./api-client";

export interface BranchDto {
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

/** Business identity shared by every branch (PAN/VAT status/contact live on
 * the tenant, not the branch — see CLAUDE.md §2.9). Returned as
 * `meta.tenant` on GET /branches — the only tenant-scoped fields a staff
 * token (not a platform JWT) can read; printed receipts use this. */
export interface TenantInfoDto {
  name: string;
  pan: string | null;
  is_vat_registered: boolean;
  business_address: string | null;
  business_phone: string | null;
  business_email: string | null;
  logo_url: string | null;
}

export const branchesApi = {
  listMine() {
    // Unified /branches endpoint. Staff tokens (from any app) return either
    // the staff's single scoped branch or all tenant branches for owner staff.
    // meta isn't typed on the shared ApiEnvelope (that's PageMeta-shaped for
    // pagination elsewhere), so read it loosely here.
    return apiClient.get<BranchDto[]>("/branches") as Promise<{
      success: boolean;
      data?: BranchDto[];
      meta?: { tenant?: TenantInfoDto };
    }>;
  },
};

/** Short display code derived from the name — the backend Branch model has
 *  no `code` column, this is purely cosmetic for IMS's UI (e.g. "Kathmandu
 *  — Main" -> "KAT"). */
export function branchCode(name: string): string {
  const letters = name.replace(/[^a-zA-Z]/g, "").toUpperCase();
  return letters.slice(0, 3) || "BR";
}
