import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { authApi } from "./auth-api";
import { authStorage, type StoredAuth } from "./auth-storage";
import { ALL_ROLES, type RoleCode } from "./roles";

export type Currency = "NPR" | "USD" | "EUR" | "INR";

export const CURRENCIES: Record<Currency, string> = {
  NPR: "Rs",
  USD: "$",
  EUR: "€",
  INR: "₹",
};

export const PRODUCT_NAME = "Dream PMS";

// TODO(properties): replace with real properties from backend once
// features/hotel_pms/properties/ is built.
export type Property = { id: string; name: string; location: string; rooms: number };
export const PROPERTIES: Property[] = [
  { id: "hg", name: "Himalaya Grand", location: "Thamel, Kathmandu", rooms: 36 },
  { id: "lr", name: "Lakeside Retreat", location: "Baidam, Pokhara", rooms: 24 },
  { id: "cv", name: "Chitwan Verandah", location: "Sauraha, Chitwan", rooms: 18 },
];

interface LoginArgs {
  username: string;
  password: string;
}

type AppState = {
  authed: boolean;
  isBootstrapping: boolean;

  actualRole: RoleCode | null;
  viewAsRole: RoleCode | null;
  effectiveRole: RoleCode | null;
  setViewAsRole: (r: RoleCode | null) => void;

  username: string | null;
  tenantId: string | null;

  login: (args: LoginArgs) => Promise<{ ok: true } | { ok: false; message: string }>;
  logout: () => void;

  currency: Currency;
  setCurrency: (c: Currency) => void;

  properties: Property[];
  propertyId: string;
  setPropertyId: (id: string) => void;
  property: Property;
};

const Ctx = createContext<AppState | null>(null);

function asRoleCode(value: string | null): RoleCode | null {
  if (!value) return null;
  return (ALL_ROLES as string[]).includes(value) ? (value as RoleCode) : null;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [viewAsRole, setViewAsRoleState] = useState<RoleCode | null>(null);
  const [currency, setCurrency] = useState<Currency>("NPR");
  const [propertyId, setPropertyId] = useState<string>(PROPERTIES[0]!.id);

  useEffect(() => {
    const stored = authStorage.read();
    setAuth(stored);
    setIsBootstrapping(false);
  }, []);

  const login = useCallback(
    async ({ username, password }: LoginArgs) => {
      try {
        const response = await authApi.login(username, password);
        const data = response.data;
        if (!data) {
          return { ok: false as const, message: "Empty response from server" };
        }
        const stored: StoredAuth = {
          token: data.token,
          role: data.role,
          tenantId: data.tenant_id,
          username,
          expiresAt: data.expires_at,
        };
        authStorage.save(stored);
        setAuth(stored);
        setViewAsRoleState(null);
        return { ok: true as const };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Login failed";
        return { ok: false as const, message };
      }
    },
    [],
  );

  const logout = useCallback(() => {
    authStorage.clear();
    setAuth(null);
    setViewAsRoleState(null);
  }, []);

  const setViewAsRole = useCallback((role: RoleCode | null) => {
    setViewAsRoleState(role);
  }, []);

  const actualRole = asRoleCode(auth?.role ?? null);
  const effectiveRole: RoleCode | null =
    actualRole === "app_owner" && viewAsRole ? viewAsRole : actualRole;

  const value = useMemo<AppState>(
    () => ({
      authed: Boolean(auth),
      isBootstrapping,
      actualRole,
      viewAsRole,
      effectiveRole,
      setViewAsRole,
      username: auth?.username ?? null,
      tenantId: auth?.tenantId ?? null,
      login,
      logout,
      currency,
      setCurrency,
      properties: PROPERTIES,
      propertyId,
      setPropertyId,
      property: PROPERTIES.find((p) => p.id === propertyId) ?? PROPERTIES[0]!,
    }),
    [
      auth,
      isBootstrapping,
      actualRole,
      viewAsRole,
      effectiveRole,
      setViewAsRole,
      login,
      logout,
      currency,
      propertyId,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

export function useMoney() {
  const { currency } = useApp();
  return (amount: number) =>
    `${CURRENCIES[currency]} ${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
