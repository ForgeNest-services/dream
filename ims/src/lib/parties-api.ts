import { apiClient } from "./api-client";

// credit_limit/opening_balance/debit/credit are Decimal on the backend —
// serialized as JSON strings. Call Number() before arithmetic (see
// app-store.tsx's num()/numOrUndefined()).
export interface PartyDto {
  id: string;
  tenant_id: string;
  name: string;
  kind: "supplier" | "customer";
  phone: string | null;
  email: string | null;
  address: string | null;
  pan: string | null;
  is_walk_in: boolean;
  is_vat_registered: boolean | null;
  credit_limit: number | string | null;
  opening_balance: number | string;
  terms: string | null;
  created_at: string;
  updated_at: string;
}

export interface LedgerEntryDto {
  id: string;
  tenant_id: string;
  party_id: string;
  date: string;
  description: string;
  reference: string | null;
  debit: number | string;
  credit: number | string;
}

export interface CreatePartyPayload {
  name: string;
  kind: "supplier" | "customer";
  phone?: string | undefined;
  email?: string | undefined;
  address?: string | undefined;
  pan?: string | undefined;
  is_vat_registered?: boolean | undefined;
  credit_limit?: number | undefined;
  opening_balance: number;
  terms?: string | undefined;
}

export interface UpdatePartyPayload {
  name: string;
  phone?: string | undefined;
  email?: string | undefined;
  address?: string | undefined;
  pan?: string | undefined;
  is_vat_registered?: boolean | undefined;
  credit_limit?: number | undefined;
  opening_balance: number;
  terms?: string | undefined;
}

export const partiesApi = {
  list(
    kind?: "supplier" | "customer",
    params: { q?: string; page?: number; per_page?: number } = {},
  ) {
    const qs = new URLSearchParams();
    if (kind) qs.set("kind", kind);
    if (params.q) qs.set("q", params.q);
    qs.set("page", String(params.page ?? 1));
    qs.set("per_page", String(params.per_page ?? 25));
    return apiClient.get<PartyDto[]>(`/ims/parties?${qs.toString()}`);
  },
  create(payload: CreatePartyPayload) {
    return apiClient.post<PartyDto>("/ims/parties", payload);
  },
  update(id: string, payload: UpdatePartyPayload) {
    return apiClient.patch<PartyDto>(`/ims/parties/${id}`, payload);
  },
  remove(id: string) {
    return apiClient.delete<{ deleted: boolean }>(`/ims/parties/${id}`);
  },
  ledger(id: string) {
    return apiClient.get<LedgerEntryDto[]>(`/ims/parties/${id}/ledger`);
  },
};

export const ledgerApi = {
  listAll() {
    return apiClient.get<LedgerEntryDto[]>("/ims/ledger");
  },
  recordPayment(input: {
    party_id: string;
    amount: number;
    date: string;
    method: string;
    reference?: string | undefined;
  }) {
    return apiClient.post<LedgerEntryDto>("/ims/ledger/payments", input);
  },
};
