import { apiClient } from "./api-client";

export interface PartyDto {
  id: string;
  tenant_id: string;
  name: string;
  kind: "supplier" | "customer";
  phone: string | null;
  email: string | null;
  address: string | null;
  pan: string | null;
  is_vat_registered: boolean | null;
  credit_limit: number | null;
  opening_balance: number;
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
  debit: number;
  credit: number;
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

export const partiesApi = {
  list(kind?: "supplier" | "customer") {
    const qs = kind ? `?kind=${kind}` : "";
    return apiClient.get<PartyDto[]>(`/ims/parties${qs}`);
  },
  create(payload: CreatePartyPayload) {
    return apiClient.post<PartyDto>("/ims/parties", payload);
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
