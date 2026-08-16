import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createSeedData, makeFiscalYear, type SeedData } from "@/data/mock";
import {
  ROLE_MODULES,
  ROLE_PERMISSIONS,
  type Category,
  type CompanyProfile,
  type DateSystem,
  type FiscalYear,
  type Invoice,
  type LedgerEntry,
  type MediaItem,
  type ModuleKey,
  type Party,
  type Permission,
  type Product,
  type Purchase,
  type PurchaseLine,
  type PaymentMethod,
  type StockMovement,
  type User,
  type Variant,
} from "@/data/types";

/** A product entered on a purchase bill — either an existing one or a brand new one. */
export type PurchaseDraftItem =
  | {
      kind: "existing";
      productId: string;
      rows: { variantId: string; qty: number; unitCost: number; sellingPrice: number }[];
    }
  | {
      kind: "new";
      name: string;
      sku: string;
      categoryId: string;
      brandId?: string | undefined;
      mediaId?: string | undefined;
      taxable: boolean;
      taxRate?: number | undefined;
      rows: {
        name: string;
        modelNo: string;
        barcode: string;
        unitId: string;
        qty: number;
        unitCost: number;
        sellingPrice: number;
        lowStockAt: number;
      }[];
    };

export interface PurchaseInput {
  date: string;
  branchId: string;
  partyId?: string | undefined;
  billNo?: string | undefined;
  note?: string | undefined;
  billAmount: number;
  paidAmount: number;
  paymentMethod: PaymentMethod;
  postToLedger: boolean;
  items: PurchaseDraftItem[];
}

interface AppState extends SeedData {
  currency: string;
  dateSystem: DateSystem;
  branchId: string | "all";
  fiscalYearId: string;
  currentUser: User | null;
  /** owner-only: preview the app as another role */
  viewAsRole: User["role"] | null;
}

interface AppContextValue extends AppState {
  effectiveRole: User["role"];
  modules: ModuleKey[];
  can: (p: Permission) => boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  setCurrency: (c: string) => void;
  setDateSystem: (d: DateSystem) => void;
  setBranchId: (b: string) => void;
  setFiscalYearId: (id: string) => void;
  addFiscalYear: (startYear: number) => FiscalYear | null;
  fiscalYear: FiscalYear;
  inFiscalYear: (iso: string) => boolean;
  setViewAsRole: (r: User["role"] | null) => void;
  // derived helpers
  categoryPath: (id: string) => string;
  childCategories: (id: string | null) => Category[];
  variantsOf: (productId: string) => Variant[];
  stockOf: (v: Variant) => number;
  productStock: (productId: string) => number;
  unitSymbol: (id: string) => string;
  partyBalance: (partyId: string) => number;
  invoiceTotal: (inv: Invoice) => number;
  // mutations
  addProduct: (
    p: Omit<Product, "id" | "createdAt">,
    variants: (Omit<Variant, "id" | "productId" | "stock"> & { initialStock?: number | undefined })[],
    stockBranchId: string,
  ) => void;
  updateProduct: (id: string, patch: Partial<Product>, variants: Variant[]) => void;
  addCategory: (name: string, parentId: string | null) => void;
  renameCategory: (id: string, name: string) => void;
  deleteCategory: (id: string) => void;
  addBrand: (name: string) => void;
  addMedia: (item: Omit<MediaItem, "id" | "uploadedAt">) => MediaItem;
  adjustStock: (input: {
    variantId: string;
    branchId: string;
    qty: number;
    reason: string;
    date: string;
  }) => void;
  restock: (input: {
    variantId: string;
    branchId: string;
    qty: number;
    unitCost: number;
    supplierId?: string | undefined;
    reference?: string | undefined;
    date: string;
    /** when true, post the bill amount to the supplier ledger */
    postToLedger?: boolean | undefined;
    billAmount?: number | undefined;
  }) => void;
  createPurchase: (input: PurchaseInput) => Purchase;
  addParty: (p: Omit<Party, "id">) => Party;

  recordPayment: (input: {
    partyId: string;
    amount: number;
    date: string;
    method: string;
    reference?: string | undefined;
  }) => void;
  createInvoice: (inv: Omit<Invoice, "id" | "number" | "userId">) => Invoice;
  convertQuotation: (id: string) => void;
  updateCompany: (patch: Partial<CompanyProfile>) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${++counter}`;

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => ({
    ...createSeedData(),
    currency: "NPR",
    dateSystem: "BS" as DateSystem,
    branchId: "all",
    fiscalYearId: "",
    currentUser: null,
    viewAsRole: null,
  }));

  useEffect(() => {
    const stored = window.localStorage.getItem("ims-session");
    if (stored) {
      setState((s) => {
        const u = s.users.find((x) => x.username === stored);
        return u ? { ...s, currentUser: u } : s;
      });
    }
  }, []);

  const login = useCallback((username: string, password: string) => {
    let ok = false;
    setState((s) => {
      const u = s.users.find((x) => x.username === username.trim().toLowerCase());
      if (!u || password.length < 4) return s;
      ok = true;
      window.localStorage.setItem("ims-session", u.username);
      return { ...s, currentUser: u, branchId: u.role === "owner" ? "all" : (u.branchIds[0] ?? "all") };
    });
    return ok;
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem("ims-session");
    setState((s) => ({ ...s, currentUser: null, viewAsRole: null }));
  }, []);

  const value = useMemo<AppContextValue>(() => {
    const fiscalYear =
      state.fiscalYears.find((f) => f.id === state.fiscalYearId) ??
      state.fiscalYears[state.fiscalYears.length - 1]!;

    const effectiveRole = state.viewAsRole ?? state.currentUser?.role ?? "cashier";
    const perms = ROLE_PERMISSIONS[effectiveRole];

    const categoryPath = (id: string): string => {
      const names: string[] = [];
      let cur = state.categories.find((c) => c.id === id);
      let guard = 0;
      while (cur && guard++ < 10) {
        names.unshift(cur.name);
        cur = cur.parentId
          ? state.categories.find((c) => c.id === cur!.parentId)
          : undefined;
      }
      return names.join(" › ");
    };

    const variantsOf = (productId: string) =>
      state.variants.filter((v) => v.productId === productId);

    const stockOf = (v: Variant) =>
      state.branchId === "all"
        ? Object.values(v.stock).reduce((a, b) => a + b, 0)
        : (v.stock[state.branchId] ?? 0);

    const invoiceTotal = (inv: Invoice) =>
      inv.lines.reduce((s, l) => s + (l.rate - l.discount) * l.qty, 0);

    return {
      ...state,
      effectiveRole,
      modules: ROLE_MODULES[effectiveRole],
      can: (p) => perms.includes(p),
      login,
      logout,
      setCurrency: (c) => setState((s) => ({ ...s, currency: c })),
      setDateSystem: (d) => setState((s) => ({ ...s, dateSystem: d })),
      setBranchId: (b) => setState((s) => ({ ...s, branchId: b })),
      fiscalYear,
      inFiscalYear: (iso) => iso >= fiscalYear.startDate && iso <= fiscalYear.endDate,
      setFiscalYearId: (id) => setState((s) => ({ ...s, fiscalYearId: id })),
      addFiscalYear: (startYear) => {
        const fy = makeFiscalYear(startYear);
        let created: FiscalYear | null = null;
        setState((s) => {
          if (s.fiscalYears.some((f) => f.startYear === startYear)) return s;
          created = fy;
          return {
            ...s,
            fiscalYears: [...s.fiscalYears, fy].sort((a, b) => a.startYear - b.startYear),
            fiscalYearId: fy.id,
          };
        });
        return created;
      },
      setViewAsRole: (r) => setState((s) => ({ ...s, viewAsRole: r })),
      categoryPath,
      childCategories: (id) => state.categories.filter((c) => c.parentId === id),
      variantsOf,
      stockOf,
      productStock: (productId) =>
        variantsOf(productId).reduce((sum, v) => sum + stockOf(v), 0),
      unitSymbol: (id) => state.units.find((u) => u.id === id)?.symbol ?? "",
      /** Outstanding amount: payable for suppliers, receivable for customers. */
      partyBalance: (partyId) => {
        const isSupplier = state.parties.find((p) => p.id === partyId)?.kind === "supplier";
        return state.ledger
          .filter((l) => l.partyId === partyId)
          .reduce(
            (sum, l) => sum + (isSupplier ? l.credit - l.debit : l.debit - l.credit),
            0,
          );
      },
      invoiceTotal,

      addProduct: (p, vs, stockBranchId) =>
        setState((s) => {
          const id = nextId("p");
          const variants: Variant[] = (
            vs.length > 0
              ? vs
              : [
                  {
                    name: "Default",
                    modelNo: p.sku,
                    barcode: "",
                    unitId: s.units[0]!.id,
                    costPrice: 0,
                    sellingPrice: 0,
                    lowStockAt: 10,
                  } as Omit<Variant, "id" | "productId" | "stock"> & {
                    initialStock?: number | undefined;
                  },
                ]
          ).map((v, i) => {
            const { initialStock, ...rest } = v;
            return {
              ...rest,
              id: `${id}-v${i + 1}`,
              productId: id,
              stock: {
                ...Object.fromEntries(s.branches.map((b) => [b.id, 0])),
                ...(initialStock ? { [stockBranchId]: initialStock } : {}),
              },
            };
          });
          const movements: StockMovement[] = variants
            .filter((v) => (v.stock[stockBranchId] ?? 0) > 0)
            .map((v) => ({
              id: nextId("mv"),
              date: new Date().toISOString(),
              branchId: stockBranchId,
              productId: v.productId,
              variantId: v.id,
              type: "adjust-in",
              qty: v.stock[stockBranchId] ?? 0,
              unitCost: v.costPrice,
              balanceAfter: v.stock[stockBranchId] ?? 0,
              reason: "Initial stock on product creation",
              userId: s.currentUser?.id ?? "u-1",
            }));
          return {
            ...s,
            products: [{ ...p, id, createdAt: new Date().toISOString() }, ...s.products],
            variants: [...s.variants, ...variants],
            movements: [...movements, ...s.movements],
          };
        }),

      updateProduct: (id, patch, vs) =>
        setState((s) => ({
          ...s,
          products: s.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
          variants: [...s.variants.filter((v) => v.productId !== id), ...vs],
        })),

      addCategory: (name, parentId) =>
        setState((s) => ({
          ...s,
          categories: [...s.categories, { id: nextId("c"), name, parentId }],
        })),
      renameCategory: (id, name) =>
        setState((s) => ({
          ...s,
          categories: s.categories.map((c) => (c.id === id ? { ...c, name } : c)),
        })),
      deleteCategory: (id) =>
        setState((s) => ({
          ...s,
          categories: s.categories.filter((c) => c.id !== id && c.parentId !== id),
        })),
      addBrand: (name) =>
        setState((s) => ({ ...s, brands: [...s.brands, { id: nextId("b"), name }] })),
      addMedia: (item) => {
        const created: MediaItem = {
          ...item,
          id: nextId("m"),
          uploadedAt: new Date().toISOString(),
        };
        setState((s) => ({ ...s, media: [created, ...s.media] }));
        return created;
      },

      adjustStock: ({ variantId, branchId, qty, reason, date }) =>
        setState((s) => {
          const variant = s.variants.find((v) => v.id === variantId);
          if (!variant) return s;
          const balance = (variant.stock[branchId] ?? 0) + qty;
          const movement: StockMovement = {
            id: nextId("mv"),
            date,
            branchId,
            productId: variant.productId,
            variantId,
            type: qty >= 0 ? "adjust-in" : "adjust-out",
            qty,
            balanceAfter: balance,
            reason,
            userId: s.currentUser?.id ?? "u-1",
          };
          return {
            ...s,
            variants: s.variants.map((v) =>
              v.id === variantId ? { ...v, stock: { ...v.stock, [branchId]: balance } } : v,
            ),
            movements: [movement, ...s.movements],
          };
        }),

      restock: ({
        variantId,
        branchId,
        qty,
        unitCost,
        supplierId,
        reference,
        date,
        postToLedger,
        billAmount,
      }) =>
        setState((s) => {
          const variant = s.variants.find((v) => v.id === variantId);
          if (!variant) return s;
          const balance = (variant.stock[branchId] ?? 0) + qty;
          const movement: StockMovement = {
            id: nextId("mv"),
            date,
            branchId,
            productId: variant.productId,
            variantId,
            type: "restock",
            qty,
            unitCost,
            balanceAfter: balance,
            reference,
            supplierId,
            userId: s.currentUser?.id ?? "u-1",
          };
          // Ledger posting is never automatic — the operator opts in and states the bill amount.
          const ledger: LedgerEntry[] =
            supplierId && postToLedger
              ? [
                  {
                    id: nextId("le"),
                    partyId: supplierId,
                    date,
                    description: "Purchase — goods received",
                    reference,
                    debit: 0,
                    credit: billAmount ?? qty * unitCost,
                  },
                  ...s.ledger,
                ]
              : s.ledger;
          return {
            ...s,
            variants: s.variants.map((v) =>
              v.id === variantId ? { ...v, stock: { ...v.stock, [branchId]: balance } } : v,
            ),
            movements: [movement, ...s.movements],
            ledger,
          };
        }),

      createPurchase: (input) => {
        const purchaseId = nextId("pu");
        const number = `PB-${fiscalYear.startYear}-${1000 + state.purchases.length + 1}`;
        let created: Purchase = {
          id: purchaseId,
          number,
          date: input.date,
          branchId: input.branchId,
          partyId: input.partyId,
          billNo: input.billNo,
          lines: [],
          itemsTotal: 0,
          billAmount: input.billAmount,
          paidAmount: input.paidAmount,
          paymentMethod: input.paymentMethod,
          postToLedger: input.postToLedger,
          note: input.note,
          userId: state.currentUser?.id ?? "u-1",
        };

        setState((s) => {
          const newProducts: Product[] = [];
          const newVariants: Variant[] = [];
          const lines: PurchaseLine[] = [];
          // variantId -> qty received, applied to branch stock at the end
          const received: { variantId: string; qty: number; unitCost: number }[] = [];
          const priceUpdates = new Map<string, { costPrice: number; sellingPrice: number }>();

          input.items.forEach((item, idx) => {
            if (item.kind === "new") {
              const pid = `${purchaseId}-p${idx + 1}`;
              newProducts.push({
                id: pid,
                name: item.name,
                sku: item.sku,
                categoryId: item.categoryId,
                brandId: item.brandId,
                mediaId: item.mediaId,
                taxable: item.taxable,
                taxRate: item.taxRate,
                createdAt: input.date,
              });
              const rate = item.taxable ? (item.taxRate ?? s.company.vatRate) : 0;
              item.rows.forEach((r, ri) => {
                const vid = `${pid}-v${ri + 1}`;
                newVariants.push({
                  id: vid,
                  productId: pid,
                  name: r.name || "Default",
                  modelNo: r.modelNo,
                  barcode: r.barcode,
                  unitId: r.unitId,
                  costPrice: r.unitCost,
                  sellingPrice: r.sellingPrice,
                  lowStockAt: r.lowStockAt,
                  stock: Object.fromEntries(s.branches.map((b) => [b.id, 0])),
                });
                if (r.qty > 0) received.push({ variantId: vid, qty: r.qty, unitCost: r.unitCost });
                lines.push({
                  id: `${vid}-l`,
                  productId: pid,
                  variantId: vid,
                  description: `${item.name} — ${r.name || "Default"}`,
                  qty: r.qty,
                  unitId: r.unitId,
                  unitCost: r.unitCost,
                  taxable: item.taxable,
                  taxRate: rate,
                  vatAmount: (r.qty * r.unitCost * rate) / 100,
                });
              });
            } else {
              const product = s.products.find((p) => p.id === item.productId);
              const taxable = product?.taxable !== false;
              const rate = taxable ? (product?.taxRate ?? s.company.vatRate) : 0;
              item.rows.forEach((r) => {
                const v = s.variants.find((x) => x.id === r.variantId);
                if (!v || r.qty <= 0) return;
                priceUpdates.set(v.id, {
                  costPrice: r.unitCost,
                  sellingPrice: r.sellingPrice || v.sellingPrice,
                });
                received.push({ variantId: v.id, qty: r.qty, unitCost: r.unitCost });
                lines.push({
                  id: `${v.id}-l-${idx}`,
                  productId: v.productId,
                  variantId: v.id,
                  description: `${product?.name ?? "Item"} — ${v.name}`,
                  qty: r.qty,
                  unitId: v.unitId,
                  unitCost: r.unitCost,
                  taxable,
                  taxRate: rate,
                  vatAmount: (r.qty * r.unitCost * rate) / 100,
                });
              });
            }
          });

          const itemsTotal = lines.reduce((sum, l) => sum + l.qty * l.unitCost, 0);
          created = { ...created, lines, itemsTotal };

          let variants = [...s.variants, ...newVariants].map((v) => {
            const pu = priceUpdates.get(v.id);
            return pu ? { ...v, ...pu } : v;
          });

          const movements: StockMovement[] = [];
          received.forEach((r) => {
            variants = variants.map((v) => {
              if (v.id !== r.variantId) return v;
              const balance = (v.stock[input.branchId] ?? 0) + r.qty;
              movements.push({
                id: nextId("mv"),
                date: input.date,
                branchId: input.branchId,
                productId: v.productId,
                variantId: v.id,
                type: "restock",
                qty: r.qty,
                unitCost: r.unitCost,
                balanceAfter: balance,
                reference: input.billNo || number,
                supplierId: input.partyId,
                userId: created.userId,
              });
              return { ...v, stock: { ...v.stock, [input.branchId]: balance } };
            });
          });

          const ledger: LedgerEntry[] = [];
          if (input.partyId && input.postToLedger) {
            if (input.billAmount > 0) {
              ledger.push({
                id: nextId("le"),
                partyId: input.partyId,
                date: input.date,
                description: `Purchase bill ${input.billNo || number}`,
                reference: input.billNo || number,
                debit: 0,
                credit: input.billAmount,
              });
            }
            if (input.paidAmount > 0) {
              ledger.push({
                id: nextId("le"),
                partyId: input.partyId,
                date: input.date,
                description: `Payment made (${input.paymentMethod})`,
                reference: input.billNo || number,
                debit: input.paidAmount,
                credit: 0,
              });
            }
          }

          return {
            ...s,
            products: [...newProducts, ...s.products],
            variants,
            movements: [...movements, ...s.movements],
            purchases: [created, ...s.purchases],
            ledger: [...ledger, ...s.ledger],
          };
        });

        return created;
      },


      addParty: (p) => {
        const party: Party = { ...p, id: nextId(p.kind === "supplier" ? "s" : "c") };
        setState((s) => {
          const ledger =
            party.openingBalance && party.openingBalance !== 0
              ? [
                  {
                    id: nextId("le"),
                    partyId: party.id,
                    date: new Date().toISOString(),
                    description: "Opening balance",
                    debit: party.kind === "supplier" ? 0 : party.openingBalance,
                    credit: party.kind === "supplier" ? party.openingBalance : 0,
                  } as LedgerEntry,
                  ...s.ledger,
                ]
              : s.ledger;
          return { ...s, parties: [...s.parties, party], ledger };
        });
        return party;
      },

      recordPayment: ({ partyId, amount, date, method, reference }) =>
        setState((s) => {
          const party = s.parties.find((p) => p.id === partyId);
          const isSupplier = party?.kind === "supplier";
          const entry: LedgerEntry = {
            id: nextId("le"),
            partyId,
            date,
            description: `Payment ${isSupplier ? "made" : "received"} (${method})`,
            reference,
            debit: isSupplier ? amount : 0,
            credit: isSupplier ? 0 : amount,
          };
          return { ...s, ledger: [entry, ...s.ledger] };
        }),

      createInvoice: (inv) => {
        const seq = 1000 + state.invoices.length + 1;
        const number =
          inv.kind === "quotation"
            ? `QT-${seq}`
            : `${state.company.invoicePrefix}-${fiscalYear.startYear}-${seq}`;
        const created: Invoice = {
          ...inv,
          id: nextId("inv"),
          number,
          userId: state.currentUser?.id ?? "u-1",
        };
        setState((s) => {
          const total = created.lines.reduce((x, l) => x + (l.rate - l.discount) * l.qty, 0);
          const movements: StockMovement[] =
            created.kind === "quotation"
              ? []
              : created.lines.map((l) => {
                  const v = s.variants.find((x) => x.id === l.variantId);
                  return {
                    id: nextId("mv"),
                    date: created.date,
                    branchId: created.branchId,
                    productId: l.productId,
                    variantId: l.variantId,
                    type: "sale" as const,
                    qty: -l.qty,
                    balanceAfter: (v?.stock[created.branchId] ?? 0) - l.qty,
                    reference: number,
                    userId: created.userId,
                  };
                });
          const ledger: LedgerEntry[] =
            created.kind === "quotation"
              ? s.ledger
              : [
                  {
                    id: nextId("le"),
                    partyId: created.customerId,
                    date: created.date,
                    description: `Sales invoice ${number}`,
                    reference: number,
                    debit: total,
                    credit: 0,
                  },
                  ...(created.paidAmount > 0
                    ? [
                        {
                          id: nextId("le"),
                          partyId: created.customerId,
                          date: created.date,
                          description: `Payment received (${created.paymentMethod})`,
                          reference: number,
                          debit: 0,
                          credit: created.paidAmount,
                        },
                      ]
                    : []),
                  ...s.ledger,
                ];
          return {
            ...s,
            invoices: [created, ...s.invoices],
            movements: [...movements, ...s.movements],
            variants:
              created.kind === "quotation"
                ? s.variants
                : s.variants.map((v) => {
                    const line = created.lines.find((l) => l.variantId === v.id);
                    if (!line) return v;
                    return {
                      ...v,
                      stock: {
                        ...v.stock,
                        [created.branchId]: (v.stock[created.branchId] ?? 0) - line.qty,
                      },
                    };
                  }),
            ledger,
          };
        });
        return created;
      },

      convertQuotation: (id) =>
        setState((s) => ({
          ...s,
          invoices: s.invoices.map((i) =>
            i.id === id
              ? {
                  ...i,
                  kind: s.company.vatRegistered ? "tax" : "abbreviated",
                  number: `${s.company.invoicePrefix}-${fiscalYear.startYear}-${1000 + s.invoices.length + 1}`,
                }
              : i,
          ),
        })),

      updateCompany: (patch) =>
        setState((s) => ({ ...s, company: { ...s.company, ...patch } })),
    };
  }, [state, login, logout]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
