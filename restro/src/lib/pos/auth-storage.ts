import type { Role } from "./data";

const KEY_SESSION = "zestro_session_v1";
const KEY_BRANCH = "zestro_branch_v1";

export type StoredSession = { username: string; role: Role };

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
      if (typeof parsed?.username === "string" && typeof parsed?.role === "string") {
        return { username: parsed.username, role: parsed.role as Role };
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
