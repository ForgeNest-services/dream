import type { Role } from "./data";

const KEY_SESSION = "zestro_session_v2";
const KEY_BRANCH = "zestro_branch_v1";

// Real staff-auth session, matching what POST /restro/auth/login returns.
// (v2: superseded the old mock {username, role}-only shape.)
export type StoredSession = {
  token: string;
  role: Role;
  name: string;
  tenantId: string;
  branchId: string | null;
  username: string;
  expiresAt: string;
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export const authStorage = {
  readSession(): StoredSession | null {
    if (!isBrowser()) return null;
    try {
      const raw = localStorage.getItem(KEY_SESSION);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<StoredSession>;
      if (
        typeof parsed?.token === "string" &&
        typeof parsed?.role === "string" &&
        typeof parsed?.tenantId === "string" &&
        typeof parsed?.username === "string" &&
        typeof parsed?.expiresAt === "string"
      ) {
        if (Date.parse(parsed.expiresAt) <= Date.now()) {
          this.writeSession(null);
          return null;
        }
        return {
          token: parsed.token,
          role: parsed.role as Role,
          name: typeof parsed.name === "string" ? parsed.name : parsed.username,
          tenantId: parsed.tenantId,
          branchId: parsed.branchId ?? null,
          username: parsed.username,
          expiresAt: parsed.expiresAt,
        };
      }
    } catch {
      /* ignore malformed */
    }
    return null;
  },
  writeSession(session: StoredSession | null): void {
    if (!isBrowser()) return;
    if (session) localStorage.setItem(KEY_SESSION, JSON.stringify(session));
    else localStorage.removeItem(KEY_SESSION);
  },
  getToken(): string | null {
    if (!isBrowser()) return null;
    return this.readSession()?.token ?? null;
  },
  readBranchId(): string | null {
    if (!isBrowser()) return null;
    return localStorage.getItem(KEY_BRANCH);
  },
  writeBranchId(id: string | null): void {
    if (!isBrowser()) return;
    if (id) localStorage.setItem(KEY_BRANCH, id);
    else localStorage.removeItem(KEY_BRANCH);
  },
};
