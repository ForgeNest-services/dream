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
import { authApi } from "@/lib/auth-api";
import { authStorage } from "@/lib/auth-storage";
import { branchesApi, branchCode, type BranchDto } from "@/lib/branches-api";
import { categoriesApi, type CategoryDto } from "@/lib/categories-api";
import { brandsApi, type BrandDto } from "@/lib/brands-api";
import { unitsApi, type UnitDto } from "@/lib/units-api";
import { mediaApi, type MediaDto } from "@/lib/media-api";
import { fiscalYearsApi, type FiscalYearDto } from "@/lib/fiscal-years-api";
import {
  productsApi,
  type ProductDto,
  type VariantDto,
  type VariantInput,
} from "@/lib/products-api";
import { stockApi, type StockMovementDto } from "@/lib/stock-api";
import { partiesApi, ledgerApi, type PartyDto, type LedgerEntryDto } from "@/lib/parties-api";
import { ApiError } from "@/lib/api-client";
import { toast } from "sonner";
import {
  ROLE_MODULES,
  ROLE_PERMISSIONS,
  type Branch,
  type Brand,
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
  type Unit,
  type User,
  type Variant,
} from "@/data/types";

const toBranch = (b: BranchDto): Branch => ({
  id: b.id,
  name: b.name,
  code: branchCode(b.name),
  address: b.address ?? "",
});
const toCategory = (c: CategoryDto): Category => ({
  id: c.id,
  name: c.name,
  parentId: c.parent_id,
});
const toBrand = (b: BrandDto): Brand => ({ id: b.id, name: b.name });
const toMedia = (m: MediaDto): MediaItem => ({
  id: m.id,
  name: m.name,
  url: m.url,
  folder: m.folder,
  sizeKb: m.size_kb,
  uploadedAt: m.uploaded_at,
});
const toUnit = (u: UnitDto): Unit => ({
  id: u.id,
  name: u.name,
  symbol: u.symbol,
  allowsDecimals: u.allows_decimals,
});
const toVariant = (v: VariantDto): Variant => ({
  id: v.id,
  productId: v.product_id,
  name: v.name,
  modelNo: v.model_no ?? "",
  barcode: v.barcode ?? "",
  unitId: v.unit_id,
  purchaseUnitId: v.purchase_unit_id ?? undefined,
  conversionFactor: v.conversion_factor ?? undefined,
  costPrice: v.cost_price,
  sellingPrice: v.selling_price,
  stock: Object.fromEntries(v.stock.map((s) => [s.branch_id, s.qty])),
  lowStockAt: v.low_stock_at,
});
const toProduct = (p: ProductDto): Product => ({
  id: p.id,
  name: p.name,
  sku: p.sku,
  categoryId: p.category_id,
  brandId: p.brand_id ?? undefined,
  mediaId: p.media_id ?? undefined,
  description: p.description ?? undefined,
  taxable: p.taxable ?? undefined,
  taxRate: p.tax_rate ?? undefined,
  createdAt: p.created_at,
});
const toMovement = (m: StockMovementDto): StockMovement => ({
  id: m.id,
  date: m.date,
  branchId: m.branch_id,
  productId: m.product_id,
  variantId: m.variant_id,
  type: m.type,
  qty: m.qty,
  unitCost: m.unit_cost ?? undefined,
  balanceAfter: m.balance_after,
  reason: m.reason ?? undefined,
  reference: m.reference ?? undefined,
  supplierId: m.supplier_id ?? undefined,
  userId: m.user_id,
});
const toFiscalYear = (f: FiscalYearDto): FiscalYear => ({
  ...makeFiscalYear(f.start_year),
  id: f.id,
});
const toParty = (p: PartyDto): Party => ({
  id: p.id,
  name: p.name,
  kind: p.kind,
  phone: p.phone ?? "",
  email: p.email ?? undefined,
  address: p.address ?? "",
  pan: p.pan ?? undefined,
  isVatRegistered: p.is_vat_registered ?? undefined,
  creditLimit: p.credit_limit ?? undefined,
  openingBalance: p.opening_balance,
  terms: p.terms ?? undefined,
});
const toLedgerEntry = (l: LedgerEntryDto): LedgerEntry => ({
  id: l.id,
  partyId: l.party_id,
  date: l.date,
  description: l.description,
  reference: l.reference ?? undefined,
  debit: l.debit,
  credit: l.credit,
});

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
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  setCurrency: (c: string) => void;
  setDateSystem: (d: DateSystem) => void;
  setBranchId: (b: string) => void;
  setFiscalYearId: (id: string) => Promise<{ ok: boolean; error?: string }>;
  addFiscalYear: (startYear: number) => Promise<{ ok: boolean; fiscalYear?: FiscalYear; error?: string }>;
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
  ) => Promise<{ ok: boolean; error?: string }>;
  updateProduct: (
    id: string,
    patch: Omit<Product, "id" | "createdAt">,
    variants: (Omit<Variant, "productId" | "stock"> & { id?: string | undefined })[],
  ) => Promise<{ ok: boolean; error?: string }>;
  addCategory: (name: string, parentId: string | null) => Promise<{ ok: boolean; error?: string }>;
  renameCategory: (id: string, name: string) => Promise<{ ok: boolean; error?: string }>;
  deleteCategory: (id: string) => Promise<{ ok: boolean; error?: string }>;
  addBrand: (name: string) => Promise<{ ok: boolean; error?: string }>;
  addMedia: (file: File, folder: string) => Promise<{ ok: boolean; media?: MediaItem; error?: string }>;
  adjustStock: (input: {
    variantId: string;
    branchId: string;
    qty: number;
    reason: string;
    date: string;
  }) => Promise<{ ok: boolean; error?: string }>;
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
  }) => Promise<{ ok: boolean; error?: string }>;
  createPurchase: (input: PurchaseInput) => Purchase;
  addParty: (p: Omit<Party, "id">) => Promise<{ ok: boolean; party?: Party; error?: string }>;

  recordPayment: (input: {
    partyId: string;
    amount: number;
    date: string;
    method: string;
    reference?: string | undefined;
  }) => Promise<{ ok: boolean; error?: string }>;
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
    const stored = authStorage.read();
    if (stored) {
      const u: User = {
        id: stored.username,
        username: stored.username,
        name: stored.username,
        role: stored.role as User["role"],
        branchIds: stored.branchId ? [stored.branchId] : [],
        active: true,
      };
      setState((s) => ({
        ...s,
        currentUser: u,
        branchId: stored.role === "owner" ? "all" : (stored.branchId ?? "all"),
      }));
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await authApi.login(username.trim(), password);
      if (!res.success || !res.data) return false;
      const { token, role, branch_id, expires_at } = res.data;
      authStorage.save({
        token,
        role,
        tenantId: res.data.tenant_id,
        branchId: branch_id,
        username: username.trim(),
        expiresAt: expires_at,
      });
      const u: User = {
        id: username.trim(),
        username: username.trim(),
        name: username.trim(),
        role: role as User["role"],
        branchIds: branch_id ? [branch_id] : [],
        active: true,
      };
      setState((s) => ({
        ...s,
        currentUser: u,
        branchId: role === "owner" ? "all" : (branch_id ?? "all"),
      }));
      return true;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    authStorage.clear();
    setState((s) => ({ ...s, currentUser: null, viewAsRole: null }));
  }, []);

  // Once real staff auth is in place, branches/categories/brands/units are
  // real per-tenant data — fetch them whenever a session becomes active.
  // Everything else (purchases, invoices...) stays on mock data until its
  // own phase.
  useEffect(() => {
    if (!state.currentUser) return;
    let cancelled = false;
    (async () => {
      try {
        const [
          branchesRes,
          categoriesRes,
          brandsRes,
          unitsRes,
          mediaRes,
          productsRes,
          movementsRes,
          fiscalYearsRes,
          partiesRes,
          ledgerRes,
        ] = await Promise.all([
          branchesApi.listMine(),
          categoriesApi.list(),
          brandsApi.list(),
          unitsApi.list(),
          mediaApi.list(),
          productsApi.list({ per_page: 100 }),
          stockApi.movements({ per_page: 100 }),
          fiscalYearsApi.list(),
          partiesApi.list(),
          ledgerApi.listAll(),
        ]);
        if (cancelled) return;
        const productDtos = productsRes.data ?? [];
        const fyDtos = fiscalYearsRes.data ?? [];
        const activeFy = fyDtos.find((f) => f.is_active) ?? fyDtos[fyDtos.length - 1];
        setState((s) => ({
          ...s,
          branches: (branchesRes.data ?? []).map(toBranch),
          categories: (categoriesRes.data ?? []).map(toCategory),
          brands: (brandsRes.data ?? []).map(toBrand),
          units: (unitsRes.data ?? []).map(toUnit),
          media: (mediaRes.data ?? []).map(toMedia),
          products: productDtos.map(toProduct),
          variants: productDtos.flatMap((p) => p.variants.map(toVariant)),
          parties: (partiesRes.data ?? []).map(toParty),
          ledger: (ledgerRes.data ?? []).map(toLedgerEntry),
          movements: (movementsRes.data ?? []).map(toMovement),
          fiscalYears: fyDtos.map(toFiscalYear),
          fiscalYearId: activeFy ? activeFy.id : s.fiscalYearId,
        }));
      } catch (e) {
        if (e instanceof ApiError) {
          toast.error("Could not load catalogue data", { description: e.message });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentUser?.id]);

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
      setFiscalYearId: async (id) => {
        try {
          const res = await fiscalYearsApi.activate(id);
          if (!res.success || !res.data) return { ok: false, error: "Failed to switch fiscal year" };
          const activated = res.data;
          setState((s) => ({
            ...s,
            fiscalYears: s.fiscalYears.map((f) =>
              f.id === activated.id ? toFiscalYear(activated) : f,
            ),
            fiscalYearId: activated.id,
          }));
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e instanceof ApiError ? e.message : "Failed to switch fiscal year" };
        }
      },
      addFiscalYear: async (startYear) => {
        try {
          const res = await fiscalYearsApi.create(startYear);
          if (!res.success || !res.data) {
            return { ok: false, error: "Failed to add fiscal year" };
          }
          const created = toFiscalYear(res.data);
          setState((s) => ({
            ...s,
            fiscalYears: [...s.fiscalYears, created].sort((a, b) => a.startYear - b.startYear),
          }));
          return { ok: true, fiscalYear: created };
        } catch (e) {
          const isYearExists = e instanceof ApiError && e.code === "YEAR_EXISTS";
          return {
            ok: false,
            error: isYearExists
              ? `Fiscal year ${startYear} already exists`
              : e instanceof ApiError
                ? e.message
                : "Failed to add fiscal year",
          };
        }
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

      addProduct: async (p, vs, stockBranchId) => {
        const variants: VariantInput[] = (
          vs.length > 0
            ? vs
            : [
                {
                  name: "Default",
                  modelNo: p.sku,
                  barcode: "",
                  unitId: state.units[0]?.id ?? "",
                  costPrice: 0,
                  sellingPrice: 0,
                  lowStockAt: 10,
                  initialStock: 0,
                },
              ]
        ).map((v) => ({
          name: v.name,
          model_no: v.modelNo || undefined,
          barcode: v.barcode || undefined,
          unit_id: v.unitId,
          purchase_unit_id: v.purchaseUnitId,
          conversion_factor: v.conversionFactor,
          cost_price: v.costPrice,
          selling_price: v.sellingPrice,
          low_stock_at: v.lowStockAt,
          initial_stock: v.initialStock,
        }));
        try {
          const res = await productsApi.create({
            name: p.name,
            sku: p.sku,
            category_id: p.categoryId,
            brand_id: p.brandId,
            media_id: p.mediaId,
            description: p.description,
            taxable: p.taxable !== false,
            tax_rate: p.taxRate,
            branch_id_for_stock: stockBranchId,
            variants,
          });
          if (!res.success || !res.data) return { ok: false, error: "Failed to create product" };
          const created = res.data;
          setState((s) => ({
            ...s,
            products: [toProduct(created), ...s.products],
            variants: [...created.variants.map(toVariant), ...s.variants],
          }));
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e instanceof ApiError ? e.message : "Failed to create product" };
        }
      },

      updateProduct: async (id, patch, vs) => {
        const variants: VariantInput[] = vs.map((v) => ({
          id: v.id,
          name: v.name,
          model_no: v.modelNo || undefined,
          barcode: v.barcode || undefined,
          unit_id: v.unitId,
          purchase_unit_id: v.purchaseUnitId,
          conversion_factor: v.conversionFactor,
          cost_price: v.costPrice,
          selling_price: v.sellingPrice,
          low_stock_at: v.lowStockAt,
        }));
        try {
          const res = await productsApi.update(id, {
            name: patch.name,
            sku: patch.sku,
            category_id: patch.categoryId,
            brand_id: patch.brandId,
            media_id: patch.mediaId,
            description: patch.description,
            taxable: patch.taxable !== false,
            tax_rate: patch.taxRate,
            variants,
          });
          if (!res.success || !res.data) return { ok: false, error: "Failed to update product" };
          const updated = res.data;
          setState((s) => ({
            ...s,
            products: s.products.map((p) => (p.id === id ? toProduct(updated) : p)),
            variants: [
              ...s.variants.filter((v) => v.productId !== id),
              ...updated.variants.map(toVariant),
            ],
          }));
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e instanceof ApiError ? e.message : "Failed to update product" };
        }
      },

      addCategory: async (name, parentId) => {
        try {
          const res = await categoriesApi.create(name, parentId);
          if (!res.success || !res.data) return { ok: false, error: "Failed to create category" };
          const created = toCategory(res.data);
          setState((s) => ({ ...s, categories: [...s.categories, created] }));
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e instanceof ApiError ? e.message : "Failed to create category" };
        }
      },
      renameCategory: async (id, name) => {
        try {
          const res = await categoriesApi.rename(id, name);
          if (!res.success || !res.data) return { ok: false, error: "Failed to rename category" };
          const updated = toCategory(res.data);
          setState((s) => ({
            ...s,
            categories: s.categories.map((c) => (c.id === id ? updated : c)),
          }));
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e instanceof ApiError ? e.message : "Failed to rename category" };
        }
      },
      deleteCategory: async (id) => {
        try {
          const res = await categoriesApi.delete(id);
          if (!res.success) return { ok: false, error: "Failed to delete category" };
          setState((s) => ({ ...s, categories: s.categories.filter((c) => c.id !== id) }));
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e instanceof ApiError ? e.message : "Failed to delete category" };
        }
      },
      addBrand: async (name) => {
        try {
          const res = await brandsApi.create(name);
          if (!res.success || !res.data) return { ok: false, error: "Failed to create brand" };
          const created = toBrand(res.data);
          setState((s) => ({ ...s, brands: [...s.brands, created] }));
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e instanceof ApiError ? e.message : "Failed to create brand" };
        }
      },
      addMedia: async (file, folder) => {
        try {
          const dto = await mediaApi.upload(file, folder);
          const created = toMedia(dto);
          setState((s) => ({ ...s, media: [created, ...s.media] }));
          return { ok: true, media: created };
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : "Upload failed" };
        }
      },

      adjustStock: async ({ variantId, branchId, qty, reason, date }) => {
        try {
          const res = await stockApi.adjust({
            variant_id: variantId,
            branch_id: branchId,
            qty,
            reason,
            date,
          });
          if (!res.success || !res.data) return { ok: false, error: "Failed to adjust stock" };
          const movement = res.data;
          setState((s) => ({
            ...s,
            variants: s.variants.map((v) =>
              v.id === variantId
                ? { ...v, stock: { ...v.stock, [branchId]: movement.balance_after } }
                : v,
            ),
            movements: [toMovement(movement), ...s.movements],
          }));
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e instanceof ApiError ? e.message : "Failed to adjust stock" };
        }
      },

      restock: async ({
        variantId,
        branchId,
        qty,
        unitCost,
        supplierId,
        reference,
        date,
        postToLedger,
      }) => {
        // Party ledger posting isn't built yet (parties/ledger are still
        // Phase 3 mock-only) — supplierId/postToLedger/billAmount are
        // accepted for UI compatibility but have no ledger effect until
        // that phase lands. Stock itself is real.
        if (supplierId && postToLedger) {
          toast.warning("Stock received, but ledger posting isn't wired up yet — no ledger entry was created.");
        }
        try {
          const res = await stockApi.restock({
            variant_id: variantId,
            branch_id: branchId,
            qty,
            unit_cost: unitCost,
            date,
            supplier_id: supplierId,
            reference,
          });
          if (!res.success || !res.data) return { ok: false, error: "Failed to restock" };
          const movement = res.data;
          setState((s) => ({
            ...s,
            variants: s.variants.map((v) =>
              v.id === variantId
                ? { ...v, costPrice: unitCost, stock: { ...v.stock, [branchId]: movement.balance_after } }
                : v,
            ),
            movements: [toMovement(movement), ...s.movements],
          }));
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e instanceof ApiError ? e.message : "Failed to restock" };
        }
      },

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


      addParty: async (p) => {
        try {
          const res = await partiesApi.create({
            name: p.name,
            kind: p.kind,
            phone: p.phone || undefined,
            email: p.email,
            address: p.address || undefined,
            pan: p.pan,
            is_vat_registered: p.isVatRegistered,
            credit_limit: p.creditLimit,
            opening_balance: p.openingBalance,
            terms: p.terms,
          });
          if (!res.success || !res.data) return { ok: false, error: "Failed to create party" };
          const created = toParty(res.data);
          setState((s) => {
            const openingEntry: LedgerEntry | null =
              created.openingBalance && created.openingBalance !== 0
                ? {
                    id: nextId("le"),
                    partyId: created.id,
                    date: new Date().toISOString(),
                    description: "Opening balance",
                    debit: created.kind === "supplier" ? 0 : created.openingBalance,
                    credit: created.kind === "supplier" ? created.openingBalance : 0,
                  }
                : null;
            return {
              ...s,
              parties: [...s.parties, created],
              ledger: openingEntry ? [openingEntry, ...s.ledger] : s.ledger,
            };
          });
          return { ok: true, party: created };
        } catch (e) {
          return { ok: false, error: e instanceof ApiError ? e.message : "Failed to create party" };
        }
      },

      recordPayment: async ({ partyId, amount, date, method, reference }) => {
        try {
          const res = await ledgerApi.recordPayment({
            party_id: partyId,
            amount,
            date,
            method,
            reference,
          });
          if (!res.success || !res.data) return { ok: false, error: "Failed to record payment" };
          const entry = toLedgerEntry(res.data);
          setState((s) => ({ ...s, ledger: [entry, ...s.ledger] }));
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e instanceof ApiError ? e.message : "Failed to record payment" };
        }
      },

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
