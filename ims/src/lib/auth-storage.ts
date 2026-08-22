const TOKEN_KEY = "ims.token";
const ROLE_KEY = "ims.role";
const TENANT_KEY = "ims.tenant_id";
const BRANCH_KEY = "ims.branch_id";
const USERNAME_KEY = "ims.username";
const EXPIRES_KEY = "ims.expires_at";

export interface StoredAuth {
  token: string;
  role: string;
  tenantId: string;
  branchId: string | null;
  username: string;
  expiresAt: string;
}

export const authStorage = {
  save(auth: StoredAuth): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(TOKEN_KEY, auth.token);
    localStorage.setItem(ROLE_KEY, auth.role);
    localStorage.setItem(TENANT_KEY, auth.tenantId);
    if (auth.branchId) {
      localStorage.setItem(BRANCH_KEY, auth.branchId);
    } else {
      localStorage.removeItem(BRANCH_KEY);
    }
    localStorage.setItem(USERNAME_KEY, auth.username);
    localStorage.setItem(EXPIRES_KEY, auth.expiresAt);
  },

  read(): StoredAuth | null {
    if (typeof window === "undefined") return null;
    const token = localStorage.getItem(TOKEN_KEY);
    const role = localStorage.getItem(ROLE_KEY);
    const tenantId = localStorage.getItem(TENANT_KEY);
    const branchId = localStorage.getItem(BRANCH_KEY);
    const username = localStorage.getItem(USERNAME_KEY);
    const expiresAt = localStorage.getItem(EXPIRES_KEY);
    if (!token || !role || !tenantId || !username || !expiresAt) return null;

    if (Date.parse(expiresAt) <= Date.now()) {
      this.clear();
      return null;
    }
    return { token, role, tenantId, branchId, username, expiresAt };
  },

  clear(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(TENANT_KEY);
    localStorage.removeItem(BRANCH_KEY);
    localStorage.removeItem(USERNAME_KEY);
    localStorage.removeItem(EXPIRES_KEY);
  },

  getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
  },
};
