import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { authStorage, type StoredSession } from "./auth-storage";
import { authApi } from "../auth-api";
import { branchesApi, type BranchDto } from "../branches-api";
import { categoriesApi } from "../categories-api";
import { menuItemsApi, type MenuItemDto } from "../menu-items-api";
import { zonesApi, type ZoneDto } from "../zones-api";
import { tablesApi, type TableDto } from "../tables-api";
import { ordersApi, type OrderDto, type OrderLineDto } from "../orders-api";
import {
  inventoryApi,
  type InventoryItemDto,
  type StockMovementDto,
} from "../inventory-api";
import { employeesApi, type EmployeeDto } from "../employees-api";
import { customersApi, type CustomerDto } from "../customers-api";
import {
  EXPENSES,
  type Category,
  type Customer,
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

export type Branch = { id: string; name: string; address: string; phone: string };

function toBranch(b: BranchDto): Branch {
  return { id: b.id, name: b.name, address: [b.address, b.city].filter(Boolean).join(", "), phone: b.phone ?? "" };
}

function toCategory(c: { id: string; name: string }): Category {
  return { id: c.id, name: c.name };
}

function toZone(z: ZoneDto): Zone {
  return { id: z.id, name: z.name };
}

function toRestaurantTable(t: TableDto): RestaurantTable {
  const reservation: Reservation | undefined =
    t.reservation_guest_name && t.reservation_date && t.reservation_time
      ? {
          guestName: t.reservation_guest_name,
          phone: t.reservation_phone ?? "",
          date: t.reservation_date,
          time: t.reservation_time,
          partySize: t.reservation_party_size ?? 1,
        }
      : undefined;
  const base: RestaurantTable = {
    id: t.id,
    label: t.label,
    groupId: t.zone_id,
    status: t.status,
  };
  if (t.merge_id) base.mergeId = t.merge_id;
  if (reservation) base.reservation = reservation;
  return base;
}

function toOrderLine(l: OrderLineDto): OrderLine {
  const line: OrderLine = {
    id: l.id,
    menuItemId: l.menu_item_id ?? "",
    name: l.name,
    price: Number(l.price),
    qty: l.qty,
    note: l.note ?? "",
    sent: l.sent,
  };
  if (l.variant_name) line.variantName = l.variant_name;
  return line;
}

function toOrder(o: OrderDto): Order {
  const order: Order = {
    id: o.id,
    tableId: o.table_id ?? "",
    type: o.type,
    // Voided lines are historical audit rows — hide them from the UI which
    // treats a bill as its live line set.
    lines: o.lines.filter((l) => !l.is_voided).map(toOrderLine),
    // Frontend Order type only knows draft|paid; treat backend "cancelled"
    // as effectively closed so the UI hides it from live views.
    status: o.status === "draft" ? "draft" : "paid",
    kitchenStatus: o.kitchen_status,
    placedAt: new Date(o.placed_at).getTime(),
    placedAtBs: o.placed_at_bs,
    discountType: o.discount_type,
    discountValue: Number(o.discount_value),
    waiter: o.waiter_name,
  };
  if (o.paid_at_bs) order.paidAtBs = o.paid_at_bs;
  if (o.settled_at) order.settledAt = new Date(o.settled_at).getTime();
  if (o.settled_at_bs) order.settledAtBs = o.settled_at_bs;
  if (o.payment_method) order.paymentMethod = o.payment_method;
  if (o.customer_id) order.customerId = o.customer_id;
  if (o.customer) {
    order.customer = {
      id: o.customer.id,
      name: o.customer.name,
      phone: o.customer.phone ?? "",
      address: o.customer.address ?? "",
    };
  }
  if (o.delivery_status) order.deliveryStatus = o.delivery_status;
  return order;
}

function toInventoryItem(dto: InventoryItemDto): InventoryItem {
  // Server sends Decimal fields as strings; UI works in numbers. We accept
  // any unit string the server has but narrow to the frontend's known set —
  // anything unrecognized falls back to "piece" so the picker never breaks.
  const unit: InventoryItem["unit"] =
    dto.unit === "kg" || dto.unit === "liter" || dto.unit === "piece" || dto.unit === "packet"
      ? dto.unit
      : "piece";
  return {
    id: dto.id,
    name: dto.name,
    category: dto.category,
    stock: Number(dto.stock),
    threshold: Number(dto.threshold),
    unit,
  };
}

function toStockMovement(dto: StockMovementDto): StockMovement {
  const movement: StockMovement = {
    id: dto.id,
    itemId: dto.item_id,
    type: dto.type,
    delta: Number(dto.delta),
    reason: dto.reason,
    by: dto.actor_name,
    at: new Date(dto.created_at).getTime(),
  };
  if (dto.note) movement.note = dto.note;
  if (dto.cost !== null) movement.cost = Number(dto.cost);
  return movement;
}

function toEmployee(dto: EmployeeDto): Employee {
  const emp: Employee = {
    id: dto.id,
    name: dto.name,
    designation: dto.designation,
    phone: dto.phone,
    salary: Number(dto.salary),
    shift: dto.shift ?? "",
    active: dto.is_active,
  };
  if (dto.email) emp.email = dto.email;
  return emp;
}

function toCustomer(dto: CustomerDto): Customer {
  return {
    id: dto.id,
    name: dto.name,
    phone: dto.phone ?? "",
    address: dto.address ?? "",
    notes: dto.notes ?? "",
    outstandingBalance: Number(dto.outstanding_balance ?? 0),
  };
}

function toMenuItem(m: MenuItemDto): MenuItem {
  return {
    id: m.id,
    name: m.name,
    categoryId: m.category_id,
    ...(m.image_url ? { image: m.image_url } : {}),
    hasVariants: m.has_variants,
    ...(m.price !== null ? { price: m.price } : {}),
    variants: m.variants.map((v) => ({ id: v.id, name: v.name, price: v.price })),
    soldOut: m.sold_out,
  };
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
  menuLoading: boolean;
  saveMenuItem: (item: MenuItem) => Promise<void>;
  deleteMenuItem: (id: string) => Promise<void>;
  toggleSoldOut: (id: string) => Promise<void>;

  zones: Zone[];
  zonesLoading: boolean;
  addZone: (name: string) => Promise<void>;
  renameZone: (id: string, name: string) => Promise<void>;
  deleteZone: (id: string) => Promise<void>;

  tables: RestaurantTable[];
  tablesLoading: boolean;
  tablesInZone: (zoneId: string) => RestaurantTable[];
  setTableCount: (zoneId: string, count: number) => Promise<void>;
  deleteTable: (id: string) => Promise<void>;
  reserveTable: (tableId: string, reservation: Reservation) => Promise<void>;
  clearReservation: (tableId: string) => Promise<void>;
  mergeTables: (ids: string[]) => Promise<void>;
  unmergeTable: (id: string) => Promise<void>;
  mergedGroup: (table: RestaurantTable) => RestaurantTable[];

  orders: Order[];
  ordersLoading: boolean;
  orderForTable: (tableId: string) => Order | undefined;
  orderById: (id: string) => Order | undefined;
  addLine: (tableId: string, line: Omit<OrderLine, "id" | "sent">) => Promise<void>;
  // Direct add — caller already has the order id (used by delivery, where
  // there's no table to look up by).
  addLineToOrder: (orderId: string, line: Omit<OrderLine, "id" | "sent">) => Promise<void>;
  // Create an empty delivery order (customer info required). Returns the
  // new order id so the caller can switch into the order-taking screen for
  // it. Kitchen doesn't see the order until Send-to-Kitchen fires, exactly
  // like a dine-in draft.
  // Creates an empty delivery order attached to the given (existing)
  // customer. Returns the new order id so the caller can immediately switch
  // into the order-taking screen for it.
  createDeliveryOrder: (customerId: string) => Promise<string | null>;
  updateLine: (
    orderId: string,
    lineId: string,
    patch: Partial<OrderLine>,
  ) => Promise<void>;
  removeLine: (orderId: string, lineId: string) => Promise<void>;
  sendToKitchen: (orderId: string) => Promise<void>;
  setDiscount: (orderId: string, type: "percent" | "flat", value: number) => Promise<void>;
  // For khata, pass a customerId — if omitted, uses the customer already
  // attached to the order (delivery orders always have one). For cash/qr,
  // customerId is ignored.
  markPaid: (
    orderId: string,
    method: "cash" | "qr" | "khata",
    customerId?: string,
  ) => Promise<void>;
  setKitchenStatus: (orderId: string, status: KitchenStatus) => Promise<void>;

  setDeliveryStatus: (orderId: string, status: DeliveryStatus) => Promise<void>;

  inventory: InventoryItem[];
  inventoryLoading: boolean;
  movements: StockMovement[];
  loadMovements: (itemId: string) => Promise<void>;
  saveInventoryItem: (item: InventoryItem) => Promise<void>;
  deleteInventoryItem: (id: string) => Promise<void>;
  restock: (itemId: string, qty: number, cost: number, note: string) => Promise<void>;
  adjustStock: (itemId: string, delta: number, reason: string, note: string) => Promise<void>;

  employees: Employee[];
  employeesLoading: boolean;
  saveEmployee: (emp: Employee) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;

  customers: Customer[];
  customersLoading: boolean;
  // Returns the saved customer so callers (e.g. inline "add during payment"
  // pickers) can immediately select the just-created row without waiting for
  // the next list refresh.
  saveCustomer: (customer: Customer) => Promise<Customer | null>;
  deleteCustomer: (id: string) => Promise<void>;
  refreshCustomers: () => Promise<void>;
  // Records a partial or full payment against a customer's khata balance.
  // amount can be less than the full outstanding — this is the whole point
  // of the settlements ledger vs the older "settle all" model. Returns the
  // new balance (0 if fully paid off) and refreshes the customer in the
  // store.
  addKhataSettlement: (
    customerId: string,
    payload: { amount: number; method: "cash" | "qr"; note?: string },
  ) => Promise<{ newBalance: number; amount: number; method: "cash" | "qr" } | null>;

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

export function PosProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<StoredSession | null>(null);
  const [viewAsRole, setViewAsRoleState] = useState<Role | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchId, setBranchIdState] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);

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

  // Load menu items for the active branch.
  useEffect(() => {
    if (!session || !branchId) {
      setMenu([]);
      return;
    }
    let cancelled = false;
    setMenuLoading(true);
    menuItemsApi
      .list(branchId)
      .then((response) => {
        if (cancelled) return;
        setMenu((response.data ?? []).map(toMenuItem));
      })
      .finally(() => {
        if (!cancelled) setMenuLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, branchId]);

  // Load zones (server auto-provisions "Main Floor" if none exist).
  useEffect(() => {
    if (!session || !branchId) {
      setZones([]);
      return;
    }
    let cancelled = false;
    setZonesLoading(true);
    zonesApi
      .list(branchId)
      .then((response) => {
        if (cancelled) return;
        setZones((response.data ?? []).map(toZone));
      })
      .finally(() => {
        if (!cancelled) setZonesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, branchId]);

  // Load tables for the active branch. Kept in one flat list; UI filters per zone.
  useEffect(() => {
    if (!session || !branchId) {
      setTables([]);
      return;
    }
    let cancelled = false;
    setTablesLoading(true);
    tablesApi
      .list(branchId)
      .then((response) => {
        if (cancelled) return;
        setTables((response.data ?? []).map(toRestaurantTable));
      })
      .finally(() => {
        if (!cancelled) setTablesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, branchId]);

  // Load orders for the active branch. Cancelled orders are filtered out —
  // they exist server-side for audit but the UI treats them as gone.
  // TODO(scale): today we fetch everything; when a branch has thousands of
  // paid orders this will get heavy. Move to paginated fetch (limit + a
  // "closed orders" view that pages back further) when we hit that.
  useEffect(() => {
    if (!session || !branchId) {
      setOrders([]);
      return;
    }
    let cancelled = false;
    setOrdersLoading(true);
    ordersApi
      .list(branchId, { limit: 200 })
      .then((response) => {
        if (cancelled) return;
        const fetched = (response.data ?? [])
          .filter((o) => o.status !== "cancelled")
          .map(toOrder);
        setOrders(fetched);
      })
      .finally(() => {
        if (!cancelled) setOrdersLoading(false);
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
  const [zones, setZones] = useState<Zone[]>([]);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>(EXPENSES);

  const settings = settingsMap[branchId] ?? defaultSettings(branch);

  // Load inventory whenever the branch changes. Movements are lazy — fetched
  // on demand when the user opens the history modal, since one item's log can
  // be long and we don't need all items' logs upfront.
  useEffect(() => {
    if (!session || !branchId) {
      setInventory([]);
      setMovements([]);
      return;
    }
    let cancelled = false;
    setInventoryLoading(true);
    inventoryApi
      .list(branchId)
      .then((response) => {
        if (cancelled) return;
        setInventory((response.data ?? []).map(toInventoryItem));
      })
      .finally(() => {
        if (!cancelled) setInventoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, branchId]);

  useEffect(() => {
    if (!session || !branchId) {
      setEmployees([]);
      return;
    }
    let cancelled = false;
    setEmployeesLoading(true);
    employeesApi
      .list(branchId)
      .then((response) => {
        if (cancelled) return;
        setEmployees((response.data ?? []).map(toEmployee));
      })
      .finally(() => {
        if (!cancelled) setEmployeesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, branchId]);

  useEffect(() => {
    if (!session || !branchId) {
      setCustomers([]);
      return;
    }
    let cancelled = false;
    setCustomersLoading(true);
    customersApi
      .list(branchId)
      .then((response) => {
        if (cancelled) return;
        setCustomers((response.data ?? []).map(toCustomer));
      })
      .finally(() => {
        if (!cancelled) setCustomersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, branchId]);

  const setTableStatus = (tableId: string, status: RestaurantTable["status"]) =>
    setTables((prev) => {
      const target = prev.find((t) => t.id === tableId);
      const mergeId = target?.mergeId;
      return prev.map((t) =>
        t.id === tableId || (mergeId && t.mergeId === mergeId) ? { ...t, status } : t,
      );
    });

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
    menuLoading,
    saveMenuItem: async (item) => {
      if (!branchId) return;
      const variantPayload = item.variants.map((v) => ({ name: v.name, price: v.price }));
      const priceField = item.hasVariants || item.price === undefined ? {} : { price: item.price };
      const existing = menu.some((m) => m.id === item.id);
      if (existing) {
        const response = await menuItemsApi.update(branchId, item.id, {
          category_id: item.categoryId,
          name: item.name,
          has_variants: item.hasVariants,
          ...priceField,
          clear_price: item.hasVariants,
          image_url: item.image ?? null,
          variants: item.hasVariants ? variantPayload : [],
        });
        if (response.data) {
          const updated = toMenuItem(response.data);
          setMenu((p) => p.map((m) => (m.id === item.id ? updated : m)));
        }
      } else {
        const response = await menuItemsApi.create(branchId, {
          category_id: item.categoryId,
          name: item.name,
          has_variants: item.hasVariants,
          ...priceField,
          image_url: item.image ?? null,
          variants: item.hasVariants ? variantPayload : [],
        });
        if (response.data) setMenu((p) => [...p, toMenuItem(response.data!)]);
      }
    },
    deleteMenuItem: async (id) => {
      if (!branchId) return;
      await menuItemsApi.remove(branchId, id);
      setMenu((p) => p.filter((m) => m.id !== id));
    },
    toggleSoldOut: async (id) => {
      if (!branchId) return;
      const current = menu.find((m) => m.id === id);
      if (!current) return;
      const response = await menuItemsApi.setSoldOut(branchId, id, !current.soldOut);
      if (response.data) {
        const updated = toMenuItem(response.data);
        setMenu((p) => p.map((m) => (m.id === id ? updated : m)));
      }
    },

    zones,
    zonesLoading,
    addZone: async (name) => {
      if (!branchId) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      try {
        const response = await zonesApi.create(branchId, { name: trimmed });
        if (response.data) setZones((p) => [...p, toZone(response.data!)]);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to add zone");
      }
    },
    renameZone: async (id, name) => {
      if (!branchId) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      try {
        const response = await zonesApi.update(branchId, id, { name: trimmed });
        if (response.data) {
          const updated = response.data;
          setZones((p) => p.map((z) => (z.id === id ? toZone(updated) : z)));
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to rename zone");
      }
    },
    deleteZone: async (id) => {
      if (!branchId) return;
      try {
        await zonesApi.remove(branchId, id);
        setZones((p) => p.filter((z) => z.id !== id));
        // Backend refuses to delete a zone with tables — but if it succeeded,
        // there weren't any, so nothing to prune locally.
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete zone");
      }
    },

    tables,
    tablesLoading,
    tablesInZone: (zoneId) => tables.filter((t) => t.groupId === zoneId),
    setTableCount: async (zoneId, count) => {
      if (!branchId) return;
      const safe = Math.max(0, Math.min(60, Math.round(count)));
      const mine = tables.filter((t) => t.groupId === zoneId);
      // Grow: create new tables with the next-available "Tn" label based on
      // what's already in the zone, so we don't collide with existing labels.
      if (safe > mine.length) {
        const usedNums = new Set(
          mine
            .map((t) => Number(t.label.replace(/^T/, "")))
            .filter((n) => Number.isFinite(n) && n > 0),
        );
        let nextNum = 1;
        const created: RestaurantTable[] = [];
        for (let i = 0; i < safe - mine.length; i++) {
          while (usedNums.has(nextNum)) nextNum++;
          const label = `T${nextNum}`;
          usedNums.add(nextNum);
          nextNum++;
          try {
            const response = await tablesApi.create(branchId, {
              zone_id: zoneId,
              label,
            });
            if (response.data) created.push(toRestaurantTable(response.data));
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to add table");
            break;
          }
        }
        if (created.length) setTables((p) => [...p, ...created]);
        return;
      }
      // Shrink: delete extras from the end. Skip any that aren't empty; toast
      // if we can't remove all requested.
      const toRemove = mine.slice(safe).reverse();
      const removed = new Set<string>();
      let blocked = 0;
      for (const t of toRemove) {
        if (t.status !== "empty") {
          blocked++;
          continue;
        }
        try {
          await tablesApi.remove(branchId, t.id);
          removed.add(t.id);
        } catch {
          blocked++;
        }
      }
      if (removed.size) setTables((p) => p.filter((t) => !removed.has(t.id)));
      if (blocked > 0) {
        toast.warning(
          `${blocked} table${blocked === 1 ? "" : "s"} couldn't be removed — clear active orders / reservations first.`,
        );
      }
    },
    deleteTable: async (id) => {
      if (!branchId) return;
      try {
        await tablesApi.remove(branchId, id);
        setTables((p) => p.filter((t) => t.id !== id));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete table");
      }
    },
    reserveTable: async (tableId, reservation) => {
      if (!branchId) return;
      try {
        const response = await tablesApi.reserve(branchId, tableId, {
          guest_name: reservation.guestName,
          phone: reservation.phone || null,
          date: reservation.date,
          time: reservation.time,
          party_size: reservation.partySize,
        });
        if (response.data) {
          const updated = toRestaurantTable(response.data);
          setTables((p) => p.map((t) => (t.id === tableId ? updated : t)));
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to reserve table");
      }
    },
    clearReservation: async (tableId) => {
      if (!branchId) return;
      try {
        const response = await tablesApi.clearReservation(branchId, tableId);
        if (response.data) {
          const updated = toRestaurantTable(response.data);
          setTables((p) => p.map((t) => (t.id === tableId ? updated : t)));
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to clear reservation");
      }
    },
    mergeTables: async (ids) => {
      if (!branchId || ids.length < 2) return;
      try {
        const response = await tablesApi.merge(branchId, ids);
        if (response.data) {
          const updated = new Map(
            response.data.map((t) => [t.id, toRestaurantTable(t)]),
          );
          setTables((p) => p.map((t) => updated.get(t.id) ?? t));
          // Fold any existing draft orders on the merged tables into the first
          // table's bill. Orders are still local mock state until Phase 5.
          const primary = ids[0]!;
          setOrders((prev) => {
            const involved = prev.filter(
              (o) => ids.includes(o.tableId) && o.status === "draft",
            );
            if (involved.length < 2) return prev;
            const lines = involved.flatMap((o) => o.lines);
            const keep = involved[0]!;
            return prev
              .filter((o) => !(involved.includes(o) && o.id !== keep.id))
              .map((o) => (o.id === keep.id ? { ...o, tableId: primary, lines } : o));
          });
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to merge tables");
      }
    },
    unmergeTable: async (id) => {
      if (!branchId) return;
      try {
        const response = await tablesApi.unmerge(branchId, id);
        if (response.data) {
          const updated = new Map(
            response.data.map((t) => [t.id, toRestaurantTable(t)]),
          );
          setTables((p) => p.map((t) => updated.get(t.id) ?? t));
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to unmerge table");
      }
    },
    mergedGroup: (table) =>
      table.mergeId ? tables.filter((t) => t.mergeId === table.mergeId) : [table],

    orders,
    ordersLoading,
    orderForTable: (tableId) => {
      const table = tables.find((t) => t.id === tableId);
      const ids = table?.mergeId
        ? tables.filter((t) => t.mergeId === table.mergeId).map((t) => t.id)
        : [tableId];
      return orders.find((o) => ids.includes(o.tableId) && o.status === "draft");
    },
    orderById: (id) => orders.find((o) => o.id === id),
    addLineToOrder: async (orderId, line) => {
      if (!branchId) return;
      try {
        const linePayload = {
          menu_item_id: line.menuItemId || null,
          variant_name: line.variantName ?? null,
          name: line.menuItemId ? undefined : line.name,
          price: line.menuItemId ? undefined : line.price,
          qty: line.qty,
          note: line.note || null,
        };
        const response = await ordersApi.addLine(branchId, orderId, linePayload);
        if (response.data) {
          const updated = toOrder(response.data);
          setOrders((p) => p.map((o) => (o.id === updated.id ? updated : o)));
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to add item");
      }
    },
    createDeliveryOrder: async (customerId) => {
      if (!branchId) return null;
      try {
        const created = await ordersApi.create(branchId, {
          type: "delivery",
          customer_id: customerId,
        });
        if (!created.data) return null;
        const fresh = toOrder(created.data);
        setOrders((p) => [...p, fresh]);
        return fresh.id;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to start delivery");
        return null;
      }
    },
    addLine: async (tableId, line) => {
      if (!branchId) return;
      try {
        // Find the merge group's existing draft (if any); otherwise create one
        // against the caller's table. Backend enforces one-open-bill-per-table
        // at the DB level, so if two waiters race, the second gets a clean
        // TABLE_ALREADY_HAS_DRAFT error.
        const table = tables.find((t) => t.id === tableId);
        const ids = table?.mergeId
          ? tables.filter((t) => t.mergeId === table.mergeId).map((t) => t.id)
          : [tableId];
        let existing = orders.find((o) => ids.includes(o.tableId) && o.status === "draft");
        if (!existing) {
          const created = await ordersApi.create(branchId, {
            type: "dine-in",
            table_id: tableId,
          });
          if (!created.data) return;
          const fresh = toOrder(created.data);
          existing = fresh;
          setOrders((p) => [...p, fresh]);
        }
        const linePayload = {
          menu_item_id: line.menuItemId || null,
          variant_name: line.variantName ?? null,
          name: line.menuItemId ? undefined : line.name,
          price: line.menuItemId ? undefined : line.price,
          qty: line.qty,
          note: line.note || null,
        };
        const response = await ordersApi.addLine(branchId, existing.id, linePayload);
        if (response.data) {
          const updated = toOrder(response.data);
          setOrders((p) => p.map((o) => (o.id === updated.id ? updated : o)));
        }
        // Backend auto-flipped this table (and its merge group) to occupied —
        // mirror it locally so the table grid updates without a refetch.
        setTableStatus(tableId, "occupied");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to add item");
      }
    },
    updateLine: async (orderId, lineId, patch) => {
      if (!branchId) return;
      try {
        const response = await ordersApi.updateLine(branchId, orderId, lineId, {
          qty: patch.qty,
          note: patch.note ?? undefined,
        });
        if (response.data) {
          const updated = toOrder(response.data);
          setOrders((p) => p.map((o) => (o.id === updated.id ? updated : o)));
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update line");
      }
    },
    removeLine: async (orderId, lineId) => {
      if (!branchId) return;
      try {
        // Deleting a sent line is refused by the backend (audit); UI's Trash
        // button treats "remove" loosely — try delete first, fall through to
        // void with an empty reason if the line was already sent.
        let response;
        try {
          response = await ordersApi.deleteLine(branchId, orderId, lineId);
        } catch (err) {
          const message = err instanceof Error ? err.message : "";
          if (message.includes("sent to the kitchen")) {
            response = await ordersApi.voidLine(branchId, orderId, lineId);
          } else {
            throw err;
          }
        }
        if (response?.data) {
          const updated = toOrder(response.data);
          setOrders((p) => p.map((o) => (o.id === updated.id ? updated : o)));
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to remove line");
      }
    },
    sendToKitchen: async (orderId) => {
      if (!branchId) return;
      try {
        const response = await ordersApi.sendToKitchen(branchId, orderId);
        if (response.data) {
          const updated = toOrder(response.data);
          setOrders((p) => p.map((o) => (o.id === updated.id ? updated : o)));
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to send to kitchen");
      }
    },
    setDiscount: async (orderId, type, val) => {
      if (!branchId) return;
      try {
        const response = await ordersApi.setDiscount(branchId, orderId, type, val);
        if (response.data) {
          const updated = toOrder(response.data);
          setOrders((p) => p.map((o) => (o.id === updated.id ? updated : o)));
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to set discount");
      }
    },
    markPaid: async (orderId, method, customerId) => {
      if (!branchId) return;
      try {
        const current = orders.find((o) => o.id === orderId);
        const response = await ordersApi.markPaid(branchId, orderId, method, customerId);
        if (response.data) {
          const updated = toOrder(response.data);
          setOrders((p) => p.map((o) => (o.id === updated.id ? updated : o)));
        }
        // Backend frees the table (whole merge group). Mirror locally.
        if (current?.tableId) setTableStatus(current.tableId, "empty");
        // A new khata order just accrued balance for the customer — refresh
        // the customer list so the outstanding badge updates without a page
        // reload.
        if (method === "khata") {
          void customersApi.list(branchId).then((r) => {
            setCustomers((r.data ?? []).map(toCustomer));
          });
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to mark paid");
      }
    },
    setKitchenStatus: async (orderId, status) => {
      if (!branchId) return;
      try {
        const response = await ordersApi.setKitchenStatus(branchId, orderId, status);
        if (response.data) {
          const updated = toOrder(response.data);
          setOrders((p) => p.map((o) => (o.id === updated.id ? updated : o)));
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update kitchen status");
      }
    },
    setDeliveryStatus: async (orderId, status) => {
      if (!branchId) return;
      try {
        const response = await ordersApi.setDeliveryStatus(branchId, orderId, status);
        if (response.data) {
          const updated = toOrder(response.data);
          setOrders((p) => p.map((o) => (o.id === updated.id ? updated : o)));
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update delivery status");
      }
    },

    inventory,
    inventoryLoading,
    movements,
    loadMovements: async (itemId) => {
      if (!branchId) return;
      try {
        const response = await inventoryApi.movements(branchId, itemId);
        const fresh = (response.data ?? []).map(toStockMovement);
        // Splice the fetched item's movements over any stale ones for that
        // item; other items' logs stay in the cache untouched.
        setMovements((prev) => [...prev.filter((m) => m.itemId !== itemId), ...fresh]);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load movement log");
      }
    },
    saveInventoryItem: async (item) => {
      if (!branchId) return;
      try {
        const existing = inventory.some((i) => i.id === item.id);
        if (existing) {
          const response = await inventoryApi.update(branchId, item.id, {
            name: item.name,
            category: item.category,
            unit: item.unit,
            threshold: item.threshold,
          });
          if (response.data) {
            const updated = toInventoryItem(response.data);
            setInventory((p) => p.map((i) => (i.id === item.id ? updated : i)));
          }
        } else {
          const response = await inventoryApi.create(branchId, {
            name: item.name,
            category: item.category,
            unit: item.unit,
            threshold: item.threshold,
            stock: item.stock,
          });
          if (response.data) setInventory((p) => [...p, toInventoryItem(response.data!)]);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save item");
      }
    },
    deleteInventoryItem: async (id) => {
      if (!branchId) return;
      try {
        await inventoryApi.remove(branchId, id);
        setInventory((p) => p.filter((i) => i.id !== id));
        setMovements((p) => p.filter((m) => m.itemId !== id));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete item");
      }
    },
    restock: async (itemId, qty, cost, note) => {
      if (!branchId) return;
      try {
        const response = await inventoryApi.restock(branchId, itemId, {
          qty,
          cost: cost || null,
          note: note || null,
        });
        if (response.data) {
          const item = toInventoryItem(response.data.item);
          const movement = toStockMovement(response.data.movement);
          setInventory((p) => p.map((i) => (i.id === itemId ? item : i)));
          setMovements((p) => [movement, ...p]);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to record restock");
      }
    },
    adjustStock: async (itemId, delta, reason, note) => {
      if (!branchId) return;
      try {
        const response = await inventoryApi.adjust(branchId, itemId, {
          delta,
          reason,
          note: note || null,
        });
        if (response.data) {
          const item = toInventoryItem(response.data.item);
          const movement = toStockMovement(response.data.movement);
          setInventory((p) => p.map((i) => (i.id === itemId ? item : i)));
          setMovements((p) => [movement, ...p]);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to record adjustment");
      }
    },

    employees,
    employeesLoading,
    saveEmployee: async (emp) => {
      if (!branchId) return;
      try {
        const existing = employees.some((e) => e.id === emp.id);
        // Blank string in the UI means "clear this field". Backend needs the
        // explicit clear_* flag since PATCH treats omitted keys as unchanged.
        const clearEmail = existing && !emp.email;
        const clearShift = existing && !emp.shift;
        if (existing) {
          const response = await employeesApi.update(branchId, emp.id, {
            name: emp.name,
            designation: emp.designation,
            phone: emp.phone,
            email: emp.email ?? null,
            salary: emp.salary,
            shift: emp.shift || null,
            is_active: emp.active,
            clear_email: clearEmail,
            clear_shift: clearShift,
          });
          if (response.data) {
            const updated = toEmployee(response.data);
            setEmployees((p) => p.map((e) => (e.id === emp.id ? updated : e)));
          }
        } else {
          const response = await employeesApi.create(branchId, {
            name: emp.name,
            designation: emp.designation,
            phone: emp.phone,
            email: emp.email || null,
            salary: emp.salary,
            shift: emp.shift || null,
          });
          if (response.data) setEmployees((p) => [...p, toEmployee(response.data!)]);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save employee");
      }
    },
    deleteEmployee: async (id) => {
      if (!branchId) return;
      try {
        await employeesApi.remove(branchId, id);
        setEmployees((p) => p.filter((e) => e.id !== id));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete employee");
      }
    },

    customers,
    customersLoading,
    saveCustomer: async (c) => {
      if (!branchId) return null;
      try {
        const existing = customers.some((x) => x.id === c.id);
        if (existing) {
          const response = await customersApi.update(branchId, c.id, {
            name: c.name,
            phone: c.phone || null,
            address: c.address || null,
            notes: c.notes || null,
            clear_phone: !c.phone,
            clear_address: !c.address,
            clear_notes: !c.notes,
          });
          if (response.data) {
            const updated = toCustomer(response.data);
            setCustomers((p) => p.map((x) => (x.id === c.id ? updated : x)));
            return updated;
          }
        } else {
          const response = await customersApi.create(branchId, {
            name: c.name,
            phone: c.phone || null,
            address: c.address || null,
            notes: c.notes || null,
          });
          if (response.data) {
            const created = toCustomer(response.data);
            setCustomers((p) => [...p, created].sort((a, b) => a.name.localeCompare(b.name)));
            return created;
          }
        }
        return null;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save customer");
        return null;
      }
    },
    deleteCustomer: async (id) => {
      if (!branchId) return;
      try {
        await customersApi.remove(branchId, id);
        setCustomers((p) => p.filter((x) => x.id !== id));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete customer");
      }
    },
    refreshCustomers: async () => {
      if (!branchId) return;
      const response = await customersApi.list(branchId);
      setCustomers((response.data ?? []).map(toCustomer));
    },
    addKhataSettlement: async (customerId, payload) => {
      if (!branchId) return null;
      try {
        const response = await customersApi.addKhataSettlement(branchId, customerId, {
          amount: payload.amount,
          method: payload.method,
          note: payload.note || null,
        });
        if (!response.data) return null;
        // Splice the customer's fresh balance in without a full refetch.
        const updated = toCustomer(response.data.customer);
        setCustomers((p) => p.map((x) => (x.id === customerId ? updated : x)));
        return {
          newBalance: Number(response.data.new_balance),
          amount: Number(response.data.settlement.amount),
          method: response.data.settlement.method,
        };
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to record settlement");
        return null;
      }
    },

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
