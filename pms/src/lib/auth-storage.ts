const TOKEN_KEY = "pms.token";
const ROLE_KEY = "pms.role";
const TENANT_KEY = "pms.tenant_id";
const USERNAME_KEY = "pms.username";
const EXPIRES_KEY = "pms.expires_at";

export interface StoredAuth {
  token: string;
  role: string;
  tenantId: string;
  username: string;
  expiresAt: string;
}

export const authStorage = {
  save(auth: StoredAuth): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(TOKEN_KEY, auth.token);
    localStorage.setItem(ROLE_KEY, auth.role);
    localStorage.setItem(TENANT_KEY, auth.tenantId);
    localStorage.setItem(USERNAME_KEY, auth.username);
    localStorage.setItem(EXPIRES_KEY, auth.expiresAt);
  },

  read(): StoredAuth | null {
    if (typeof window === "undefined") return null;
    const token = localStorage.getItem(TOKEN_KEY);
    const role = localStorage.getItem(ROLE_KEY);
    const tenantId = localStorage.getItem(TENANT_KEY);
    const username = localStorage.getItem(USERNAME_KEY);
    const expiresAt = localStorage.getItem(EXPIRES_KEY);
    if (!token || !role || !tenantId || !username || !expiresAt) return null;

    if (Date.parse(expiresAt) <= Date.now()) {
      this.clear();
      return null;
    }
    return { token, role, tenantId, username, expiresAt };
  },

  clear(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(TENANT_KEY);
    localStorage.removeItem(USERNAME_KEY);
    localStorage.removeItem(EXPIRES_KEY);
  },

  getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
  },
};
