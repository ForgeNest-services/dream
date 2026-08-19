import { authStorage } from "./auth-storage";

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "https://api.srotaapps.com/api";

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: { code: string; message: string };
}

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiEnvelope<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) ?? {}),
  };

  const token = authStorage.getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    // non-JSON response
  }

  if (!response.ok) {
    const code = payload?.error?.code ?? "REQUEST_FAILED";
    const message = payload?.error?.message ?? response.statusText;
    throw new ApiError(code, message, response.status);
  }

  return payload ?? { success: true };
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
