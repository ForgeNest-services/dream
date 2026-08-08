import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authStorage, type StoredSession } from "./auth-storage";
import { authApi } from "../auth-api";
import { branchesApi, type BranchDto } from "../branches-api";
import { categoriesApi } from "../categories-api";
import {
  EMPLOYEES,
  DEFAULT_ZONES,
  EXPENSES,
  INVENTORY,
  MENU_ITEMS,
  makeTables,
  type Category,
  type DeliveryInfo,
  type DeliveryStatus,
  type Employee,
  type Expense,
  type InventoryItem,
  type MenuItem,
  type Order,
  type OrderLine,
  type Reservation,
  type RestaurantTable,
  type Role,
  type Settings,
  type StockMovement,
  type Zone,
  type KitchenStatus,
} from "./data";

const uid = () => Math.random().toString(36).slice(2, 10);

export type Branch = { id: string; name: string; address: string; phone: string };

function toBranch(b: BranchDto): Branch {
  return { id: b.id, name: b.name, address: [b.address, b.city].filter(Boolean).join(", "), phone: b.phone ?? "" };
}

function toCategory(c: { id: string; name: string }): Category {
  return { id: c.id, name: c.name };
}

type LoginResult = { ok: true } | { ok: false; message: string };

type Ctx = {
  session: StoredSession | null;
  isBootstrapping: boolean;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => void;

  actualRole: Role | null;
  viewAsRole: Role | null;
  effectiveRole: Role | null;
  setViewAsRole: (role: Role | null) => void;

  branches: Branch[];
  branchesLoading: boolean;
  canSwitchBranch: boolean;
  branchId: string;
  setBranchId: (id: string) => void;
  branch: Branch | null;

  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;

  categories: Category[];
  categoriesLoading: boolean;
  addCategory: (name: string) => Promise<void>;
  renameCategory: (id: string, name: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  menu: MenuItem[];
  saveMenuItem: (item: MenuItem) => void;
  deleteMenuItem: (id: string) => void;
  toggleSoldOut: (id: string) => void;

  zones: Zone[];
  addZone: (name: string) => void;
  renameZone: (id: string, name: string) => void;
  deleteZone: (id: string) => void;

  tables: RestaurantTable[];
  tablesInZone: (zoneId: string) => RestaurantTable[];
  setTableCount: (zoneId: string, count: number) => void;
  deleteTable: (id: string) => void;
  reserveTable: (tableId: string, reservation: Reservation) => void;
  clearReservation: (tableId: string) => void;
  mergeTables: (ids: string[]) => void;
  unmergeTable: (id: string) => void;
  mergedGroup: (table: RestaurantTable) => RestaurantTable[];

  orders: Order[];
  orderForTable: (tableId: string) => Order | undefined;
  addLine: (tableId: string, line: Omit<OrderLine, "id" | "sent">) => void;
  updateLine: (orderId: string, lineId: string, patch: Partial<OrderLine>) => void;
  removeLine: (orderId: string, lineId: string) => void;
  sendToKitchen: (orderId: string) => void;
  setDiscount: (orderId: string, type: "percent" | "flat", value: number) => void;
  markPaid: (orderId: string, method: "cash" | "qr" | "card") => void;
  setKitchenStatus: (orderId: string, status: KitchenStatus) => void;

  addDeliveryOrder: (info: DeliveryInfo, lines: Omit<OrderLine, "id" | "sent">[]) => void;
  setDeliveryStatus: (orderId: string, status: DeliveryStatus) => void;

  inventory: InventoryItem[];
  movements: StockMovement[];
  saveInventoryItem: (item: InventoryItem) => void;
  deleteInventoryItem: (id: string) => void;
  restock: (itemId: string, qty: number, cost: number, note: string) => void;
  adjustStock: (itemId: string, delta: number, reason: string, note: string) => void;

  employees: Employee[];
  saveEmployee: (emp: Employee) => void;
  deleteEmployee: (id: string) => void;

  expenses: Expense[];
  saveExpense: (expense: Expense) => void;
  deleteExpense: (id: string) => void;
};

const PosContext = createContext<Ctx | null>(null);

const defaultSettings = (branch: Branch | null): Settings => ({
  restaurantName: "Restro POS",
  branchAddress: branch?.address ?? "",
  branchPhone: branch?.phone ?? "",
  vatEnabled: true,
  vatRate: 13,
});

const seedDelivery = (): Order[] => [
  {
    id: "d1",
    tableId: "",
    type: "delivery",
    delivery: {
      customerName: "Prabin Karki",
      phone: "9841002233",
      address: "Baluwatar, Ward 4, Kathmandu",
      status: "pending",
    },
    lines: [
      { id: "dl1", menuItemId: "m13", name: "Steam Momo", variantName: "Chicken", price: 200, qty: 2, note: "Extra achar", sent: true },
      { id: "dl2", menuItemId: "m1", name: "Milk Tea", price: 60, qty: 2, note: "", sent: true },
    ],
    status: "draft",
    kitchenStatus: "cooking",
    placedAt: Date.now() - 12 * 60000,
    discountType: "percent",
    discountValue: 0,
    waiter: "Bina Tamang",
  },
  {
    id: "d2",
    tableId: "",
    type: "delivery",
    delivery: {
      customerName: "Sabina Thapa",
      phone: "9812223344",
      address: "Jhamsikhel, Lalitpur",
      status: "out",
    },
    lines: [
      { id: "dl3", menuItemId: "m16", name: "Thakali Khana Set", variantName: "Mutton", price: 650, qty: 1, note: "", sent: true },
    ],
    status: "draft",
    kitchenStatus: "ready",
    placedAt: Date.now() - 40 * 60000,
    discountType: "percent",
    discountValue: 0,
    waiter: "Ramesh Gurung",
  },
  {
    id: "d3",
    tableId: "",
    type: "delivery",
    delivery: {
      customerName: "Anup Lama",
      phone: "9803344556",
      address: "New Baneshwor, Kathmandu",
      status: "delivered",
    },
    lines: [
      { id: "dl4", menuItemId: "m10", name: "Chicken Burger", price: 350, qty: 3, note: "", sent: true },
    ],
    status: "paid",
    kitchenStatus: "served",
    placedAt: Date.now() - 3 * 3600000,
    discountType: "percent",
    discountValue: 0,
    paymentMethod: "cash",
    waiter: "Bina Tamang",
  },
];

export function PosProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<StoredSession | null>(null);
  const [viewAsRole, setViewAsRoleState] = useState<Role | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchId, setBranchIdState] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  useEffect(() => {
    const stored = authStorage.readSession();
    if (stored) setSessionState(stored);
    setIsBootstrapping(false);
  }, []);

  // Load branches once authenticated. Owner (branchId=null on the token)
  // gets every branch and can switch; staff are locked to their own.
  useEffect(() => {
    if (!session) {
      setBranches([]);
      setBranchIdState("");
      return;
    }
    let cancelled = false;
    setBranchesLoading(true);
    branchesApi
      .listMine()
      .then((response) => {
        if (cancelled) return;
        const list = (response.data ?? []).map(toBranch);
        setBranches(list);
        setBranchIdState((current) => {
          if (current && list.some((b) => b.id === current)) return current;
          const stored = authStorage.readBranchId();
          if (stored && list.some((b) => b.id === stored)) return stored;
          return session.branchId ?? list[0]?.id ?? "";
        });
      })
      .finally(() => {
        if (!cancelled) setBranchesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const setBranchId = useCallback((id: string) => {
    setBranchIdState(id);
    authStorage.writeBranchId(id);
  }, []);

  // Load categories for the active branch. Auto-provisioning of sensible
  // defaults happens server-side on first access for a branch.
  useEffect(() => {
    if (!session || !branchId) {
      setCategories([]);
      return;
    }
    let cancelled = false;
    setCategoriesLoading(true);
    categoriesApi
      .list(branchId)
      .then((response) => {
        if (cancelled) return;
        setCategories((response.data ?? []).map(toCategory));
      })
      .finally(() => {
        if (!cancelled) setCategoriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, branchId]);

  const login = useCallback(async (username: string, password: string): Promise<LoginResult> => {
    try {
      const response = await authApi.login(username, password);
      const data = response.data;
      if (!data) return { ok: false, message: "Empty response from server" };
      const stored: StoredSession = {
        token: data.token,
        role: data.role as Role,
        tenantId: data.tenant_id,
        branchId: data.branch_id,
        username,
        expiresAt: data.expires_at,
      };
      authStorage.writeSession(stored);
      setSessionState(stored);
      setViewAsRoleState(null);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      return { ok: false, message };
    }
  }, []);

  const logout = useCallback(() => {
    authStorage.writeSession(null);
    setSessionState(null);
    setViewAsRoleState(null);
  }, []);

  const setViewAsRole = useCallback((role: Role | null) => setViewAsRoleState(role), []);

  const actualRole = session?.role ?? null;
  const effectiveRole = actualRole === "owner" && viewAsRole ? viewAsRole : actualRole;
  const canSwitchBranch = actualRole === "owner";
  const branch = branches.find((b) => b.id === branchId) ?? branches[0] ?? null;

  const [settingsMap, setSettingsMap] = useState<Record<string, Settings>>({});
  const [menu, setMenu] = useState<MenuItem[]>(MENU_ITEMS);
  const [zones, setZones] = useState<Zone[]>(DEFAULT_ZONES);
  const [tables, setTables] = useState<RestaurantTable[]>(makeTables());
  const [orders, setOrders] = useState<Order[]>(seedDelivery());
  const [inventory, setInventory] = useState<InventoryItem[]>(INVENTORY);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [employees, setEmployees] = useState<Employee[]>(EMPLOYEES);
  const [expenses, setExpenses] = useState<Expense[]>(EXPENSES);

  const settings = settingsMap[branchId] ?? defaultSettings(branch);
  const actor = session?.username ?? "system";

  const setTableStatus = (tableId: string, status: RestaurantTable["status"]) =>
    setTables((prev) => {
      const target = prev.find((t) => t.id === tableId);
      const mergeId = target?.mergeId;
      return prev.map((t) =>
        t.id === tableId || (mergeId && t.mergeId === mergeId) ? { ...t, status } : t,
      );
    });

  const ensureOrder = (tableId: string, list: Order[]): [Order, Order[]] => {
    const existing = list.find((o) => o.tableId === tableId && o.status === "draft");
    if (existing) return [existing, list];
    const fresh: Order = {
      id: uid(),
      tableId,
      type: "dine-in",
      lines: [],
      status: "draft",
      kitchenStatus: "new",
      placedAt: Date.now(),
      discountType: "percent",
      discountValue: 0,
      waiter: actor,
    };
    return [fresh, [...list, fresh]];
  };

  const value: Ctx = {
    session,
    isBootstrapping,
    login,
    logout,

    actualRole,
    viewAsRole,
    effectiveRole,
    setViewAsRole,

    branches,
    branchesLoading,
    canSwitchBranch,
    branchId,
    setBranchId,
    branch,

    settings,
    updateSettings: (patch) =>
      setSettingsMap((prev) => ({ ...prev, [branchId]: { ...settings, ...patch } })),

    categories,
    categoriesLoading,
    addCategory: async (name) => {
      if (!branchId) return;
      const response = await categoriesApi.create(branchId, { name });
      if (response.data) setCategories((p) => [...p, toCategory(response.data!)]);
    },
    renameCategory: async (id, name) => {
      if (!branchId) return;
      const response = await categoriesApi.update(branchId, id, { name });
      if (response.data) {
        const updated = response.data;
        setCategories((p) => p.map((c) => (c.id === id ? toCategory(updated) : c)));
      }
    },
    deleteCategory: async (id) => {
      if (!branchId) return;
      await categoriesApi.remove(branchId, id);
      setCategories((p) => p.filter((c) => c.id !== id));
      setMenu((p) => p.filter((m) => m.categoryId !== id));
    },

    menu,
    saveMenuItem: (item) =>
      setMenu((p) => (p.some((m) => m.id === item.id) ? p.map((m) => (m.id === item.id ? item : m)) : [...p, item])),
    deleteMenuItem: (id) => setMenu((p) => p.filter((m) => m.id !== id)),
    toggleSoldOut: (id) =>
      setMenu((p) => p.map((m) => (m.id === id ? { ...m, soldOut: !m.soldOut } : m))),

    zones,
    addZone: (name) => setZones((p) => [...p, { id: `z${uid()}`, name: name.trim() || `Zone ${p.length + 1}` }]),
    renameZone: (id, name) => setZones((p) => p.map((z) => (z.id === id ? { ...z, name } : z))),
    deleteZone: (id) => {
      setZones((p) => p.filter((z) => z.id !== id));
      setTables((p) => p.filter((t) => t.groupId !== id));
    },

    tables,
    tablesInZone: (zoneId) => tables.filter((t) => t.groupId === zoneId),
    setTableCount: (zoneId, count) =>
      setTables((prev) => {
        const others = prev.filter((t) => t.groupId !== zoneId);
        const mine = prev.filter((t) => t.groupId === zoneId);
        const safe = Math.max(0, Math.min(60, Math.round(count)));
        if (safe <= mine.length) return [...others, ...mine.slice(0, safe)];
        const extra = Array.from({ length: safe - mine.length }, (_, i) => ({
          id: `${zoneId}-t${mine.length + i + 1}-${uid()}`,
          label: `T${mine.length + i + 1}`,
          groupId: zoneId,
          status: "empty" as RestaurantTable["status"],
        }));
        return [...others, ...mine, ...extra];
      }),
    deleteTable: (id) => setTables((p) => p.filter((t) => t.id !== id)),
    reserveTable: (tableId, reservation) =>
      setTables((p) =>
        p.map((t) => (t.id === tableId ? { ...t, status: "reserved", reservation } : t)),
      ),
    clearReservation: (tableId) =>
      setTables((p) =>
        p.map((t) => {
          if (t.id !== tableId) return t;
          const { reservation: _drop, ...rest } = t;
          return { ...rest, status: "empty" };
        }),
      ),
    mergeTables: (ids) => {
      if (ids.length < 2) return;
      const zone = tables.find((t) => t.id === ids[0])?.groupId;
      if (ids.some((id) => tables.find((t) => t.id === id)?.groupId !== zone)) return;
      const mergeId = uid();
      setTables((p) => p.map((t) => (ids.includes(t.id) ? { ...t, mergeId } : t)));
      // fold any existing draft orders into the first table's bill
      const primary = ids[0]!;
      setOrders((prev) => {
        const involved = prev.filter((o) => ids.includes(o.tableId) && o.status === "draft");
        if (involved.length < 2) return prev;
        const lines = involved.flatMap((o) => o.lines);
        const keep = involved[0]!;
        return prev
          .filter((o) => !(involved.includes(o) && o.id !== keep.id))
          .map((o) => (o.id === keep.id ? { ...o, tableId: primary, lines } : o));
      });
    },
    unmergeTable: (id) =>
      setTables((p) => {
        const target = p.find((t) => t.id === id);
        if (!target?.mergeId) return p;
        return p.map((t) => {
          if (t.mergeId !== target.mergeId) return t;
          const { mergeId: _drop, ...rest } = t;
          return rest;
        });
      }),
    mergedGroup: (table) =>
      table.mergeId ? tables.filter((t) => t.mergeId === table.mergeId) : [table],

    orders,
    orderForTable: (tableId) => {
      const table = tables.find((t) => t.id === tableId);
      const ids = table?.mergeId
        ? tables.filter((t) => t.mergeId === table.mergeId).map((t) => t.id)
        : [tableId];
      return orders.find((o) => ids.includes(o.tableId) && o.status === "draft");
    },
    addLine: (tableId, line) => {
      setOrders((prev) => {
        const table = tables.find((t) => t.id === tableId);
        const ids = table?.mergeId
          ? tables.filter((t) => t.mergeId === table.mergeId).map((t) => t.id)
          : [tableId];
        const existing = prev.find((o) => ids.includes(o.tableId) && o.status === "draft");
        const [order, list] = existing ? [existing, prev] : ensureOrder(tableId, prev);
        return list.map((o) => {
          if (o.id !== order.id) return o;
          const match = o.lines.find(
            (l) =>
              !l.sent &&
              l.menuItemId === line.menuItemId &&
              (l.variantName ?? "") === (line.variantName ?? ""),
          );
          if (match) {
            return {
              ...o,
              lines: o.lines.map((l) => (l.id === match.id ? { ...l, qty: l.qty + line.qty } : l)),
            };
          }
          return { ...o, lines: [...o.lines, { ...line, id: uid(), sent: false }] };
        });
      });
      setTableStatus(tableId, "occupied");
    },
    updateLine: (orderId, lineId, patch) =>
      setOrders((p) =>
        p.map((o) =>
          o.id === orderId
            ? { ...o, lines: o.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)) }
            : o,
        ),
      ),
    removeLine: (orderId, lineId) =>
      setOrders((p) =>
        p.map((o) => (o.id === orderId ? { ...o, lines: o.lines.filter((l) => l.id !== lineId) } : o)),
      ),
    sendToKitchen: (orderId) =>
      setOrders((p) =>
        p.map((o) =>
          o.id === orderId
            ? {
                ...o,
                placedAt: o.lines.some((l) => l.sent) ? o.placedAt : Date.now(),
                kitchenStatus: o.kitchenStatus === "served" ? "new" : o.kitchenStatus,
                lines: o.lines.map((l) => ({ ...l, sent: true })),
              }
            : o,
        ),
      ),
    setDiscount: (orderId, type, val) =>
      setOrders((p) =>
        p.map((o) => (o.id === orderId ? { ...o, discountType: type, discountValue: val } : o)),
      ),
    markPaid: (orderId, method) => {
      const order = orders.find((o) => o.id === orderId);
      setOrders((p) =>
        p.map((o) => (o.id === orderId ? { ...o, status: "paid", paymentMethod: method } : o)),
      );
      if (order?.tableId) setTableStatus(order.tableId, "empty");
    },
    setKitchenStatus: (orderId, status) =>
      setOrders((p) => p.map((o) => (o.id === orderId ? { ...o, kitchenStatus: status } : o))),

    addDeliveryOrder: (info, lines) =>
      setOrders((p) => [
        ...p,
        {
          id: uid(),
          tableId: "",
          type: "delivery",
          delivery: info,
          lines: lines.map((l) => ({ ...l, id: uid(), sent: true })),
          status: "draft",
          kitchenStatus: "new",
          placedAt: Date.now(),
          discountType: "percent",
          discountValue: 0,
          waiter: actor,
        },
      ]),
    setDeliveryStatus: (orderId, status) =>
      setOrders((p) =>
        p.map((o) =>
          o.id === orderId && o.delivery ? { ...o, delivery: { ...o.delivery, status } } : o,
        ),
      ),

    inventory,
    movements,
    saveInventoryItem: (item) =>
      setInventory((p) =>
        p.some((i) => i.id === item.id) ? p.map((i) => (i.id === item.id ? item : i)) : [...p, item],
      ),
    deleteInventoryItem: (id) => {
      setInventory((p) => p.filter((i) => i.id !== id));
      setMovements((p) => p.filter((m) => m.itemId !== id));
    },
    restock: (itemId, qty, cost, note) => {
      setInventory((p) => p.map((i) => (i.id === itemId ? { ...i, stock: i.stock + qty } : i)));
      setMovements((p) => [
        { id: uid(), itemId, type: "restock", delta: qty, reason: "Restock", note, cost, by: actor, at: Date.now() },
        ...p,
      ]);
    },
    adjustStock: (itemId, delta, reason, note) => {
      setInventory((p) =>
        p.map((i) => (i.id === itemId ? { ...i, stock: Math.max(0, i.stock + delta) } : i)),
      );
      setMovements((p) => [
        { id: uid(), itemId, type: "adjust", delta, reason, note, by: actor, at: Date.now() },
        ...p,
      ]);
    },

    employees,
    saveEmployee: (emp) =>
      setEmployees((p) =>
        p.some((e) => e.id === emp.id) ? p.map((e) => (e.id === emp.id ? emp : e)) : [...p, emp],
      ),
    deleteEmployee: (id) => setEmployees((p) => p.filter((e) => e.id !== id)),

    expenses,
    saveExpense: (expense) =>
      setExpenses((p) =>
        p.some((e) => e.id === expense.id)
          ? p.map((e) => (e.id === expense.id ? expense : e))
          : [{ ...expense }, ...p],
      ),
    deleteExpense: (id) => setExpenses((p) => p.filter((e) => e.id !== id)),
  };

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}

export function usePos() {
  const ctx = useContext(PosContext);
  if (!ctx) throw new Error("usePos must be used inside PosProvider");
  return ctx;
}

export function useBillTotals(order: Order | undefined, vatEnabled: boolean, vatRate: number) {
  return useMemo(() => {
    const subtotal = order?.lines.reduce((s, l) => s + l.price * l.qty, 0) ?? 0;
    const discount =
      order?.discountType === "percent"
        ? (subtotal * (order?.discountValue ?? 0)) / 100
        : (order?.discountValue ?? 0);
    const taxable = Math.max(0, subtotal - discount);
    const vat = vatEnabled ? (taxable * vatRate) / 100 : 0;
    return { subtotal, discount, vat, total: taxable + vat };
  }, [order, vatEnabled, vatRate]);
}

export function billTotals(order: Order | undefined, vatEnabled: boolean, vatRate: number) {
  const subtotal = order?.lines.reduce((s, l) => s + l.price * l.qty, 0) ?? 0;
  const discount =
    order?.discountType === "percent"
      ? (subtotal * (order?.discountValue ?? 0)) / 100
      : (order?.discountValue ?? 0);
  const taxable = Math.max(0, subtotal - discount);
  const vat = vatEnabled ? (taxable * vatRate) / 100 : 0;
  return { subtotal, discount, vat, total: taxable + vat };
}
