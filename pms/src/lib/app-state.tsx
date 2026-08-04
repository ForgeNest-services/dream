import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Role = "Owner" | "Manager" | "Front Desk" | "Accountant";
export type Currency = "NPR" | "USD" | "EUR" | "INR";

export const CURRENCIES: Record<Currency, string> = {
  NPR: "Rs",
  USD: "$",
  EUR: "€",
  INR: "₹",
};

export const ROLES: Role[] = ["Owner", "Manager", "Front Desk", "Accountant"];

export const PRODUCT_NAME = "Dream PMS";

export type Property = { id: string; name: string; location: string; rooms: number };

export const PROPERTIES: Property[] = [
  { id: "hg", name: "Himalaya Grand", location: "Thamel, Kathmandu", rooms: 36 },
  { id: "lr", name: "Lakeside Retreat", location: "Baidam, Pokhara", rooms: 24 },
  { id: "cv", name: "Chitwan Verandah", location: "Sauraha, Chitwan", rooms: 18 },
];

type AppState = {
  authed: boolean;
  login: () => void;
  logout: () => void;
  role: Role;
  setRole: (r: Role) => void;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  userName: string;
  properties: Property[];
  propertyId: string;
  setPropertyId: (id: string) => void;
  property: Property;
};

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [role, setRole] = useState<Role>("Owner");
  const [currency, setCurrency] = useState<Currency>("NPR");
  const [propertyId, setPropertyId] = useState<string>(PROPERTIES[0]!.id);

  const value = useMemo<AppState>(
    () => ({
      authed,
      login: () => setAuthed(true),
      logout: () => setAuthed(false),
      role,
      setRole,
      currency,
      setCurrency,
      userName: "Aarati Shrestha",
      properties: PROPERTIES,
      propertyId,
      setPropertyId,
      property: PROPERTIES.find((p) => p.id === propertyId) ?? PROPERTIES[0]!,
    }),
    [authed, role, currency, propertyId],
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
