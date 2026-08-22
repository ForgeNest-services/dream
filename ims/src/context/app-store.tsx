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
import {
  branchesApi,
  branchCode,
  type BranchDto,
  type TenantInfoDto,
} from "@/lib/branches-api";
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
import {
  purchasesApi,
  type PurchaseDto,
  type CreatePurchasePayload,
  type PurchaseItemPayload,
} from "@/lib/purchases-api";
import { invoicesApi, type InvoiceDto, type CreateInvoicePayload } from "@/lib/invoices-api";
import { branchSettingsApi } from "@/lib/branch-settings-api";
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
  type InvoiceLine,
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

/** Backend Decimal fields serialize as JSON strings (Pydantic's default for
 *  Decimal, confirmed across every /ims endpoint — e.g. "cost_price":"18.00")
 *  even though the DTO types declare them as `number`. Every numeric field
 *  read from the API must go through this before use, or arithmetic like
 *  `price + price * rate / 100` silently does string concatenation instead
 *  of addition, and `.toFixed()` on the result throws "not a function". */
const num = (v: number | string | null | undefined): number => (v == null ? 0 : Number(v));
const numOrUndefined = (v: number | string | null | undefined): number | undefined =>
  v == null ? undefined : Number(v);

const toBranch = (b: BranchDto): Branch => ({
  id: b.id,
  name: b.name,
  code: branchCode(b.name),
  address: b.address ?? "",
});
/** Name/PAN/contact are real tenant fields (see GET /branches's
 * meta.tenant), read-only here — edited in the admin app. isVatRegisteredTenant
 * gates whether the branch-level "apply VAT on bills" toggle can ever be
 * turned on; it is NOT the same as vatRegistered (see CompanyProfile).
 * invoicePrefix has no backend home yet and stays whatever local state had. */
const toCompanyPatch = (t: TenantInfoDto) => ({
  name: t.name,
  legalName: t.name,
  pan: t.pan ?? "",
  isVatRegisteredTenant: t.is_vat_registered,
  address: t.business_address ?? "",
  phone: t.business_phone ?? "",
  email: t.business_email ?? "",
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
  conversionFactor: numOrUndefined(v.conversion_factor),
  costPrice: num(v.cost_price),
  sellingPrice: num(v.selling_price),
  stock: Object.fromEntries(v.stock.map((s) => [s.branch_id, num(s.qty)])),
  lowStockAt: num(v.low_stock_at),
  expiryDate: v.expiry_date ?? undefined,
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
  taxRate: numOrUndefined(p.tax_rate),
  createdAt: p.created_at,
});
const toMovement = (m: StockMovementDto): StockMovement => ({
  id: m.id,
  date: m.date,
  branchId: m.branch_id,
  productId: m.product_id,
  variantId: m.variant_id,
  type: m.type,
  qty: num(m.qty),
  unitCost: numOrUndefined(m.unit_cost),
  balanceAfter: num(m.balance_after),
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
  creditLimit: numOrUndefined(p.credit_limit),
  openingBalance: num(p.opening_balance),
  terms: p.terms ?? undefined,
});
const toLedgerEntry = (l: LedgerEntryDto): LedgerEntry => ({
  id: l.id,
  partyId: l.party_id,
  date: l.date,
  description: l.description,
  reference: l.reference ?? undefined,
  debit: num(l.debit),
  credit: num(l.credit),
});
const toPurchase = (p: PurchaseDto): Purchase => ({
  id: p.id,
  number: p.number,
  date: p.date,
  branchId: p.branch_id,
  partyId: p.party_id ?? undefined,
  billNo: p.bill_no ?? undefined,
  lines: p.lines.map(
    (l): PurchaseLine => ({
      id: l.id,
      productId: l.product_id,
      variantId: l.variant_id,
      description: l.description,
      qty: num(l.qty),
      unitId: l.unit_id,
      unitCost: num(l.unit_cost),
      taxable: l.taxable,
      taxRate: num(l.tax_rate),
      vatAmount: num(l.vat_amount),
    }),
  ),
  itemsTotal: num(p.items_total),
  billAmount: num(p.bill_amount),
  paidAmount: num(p.paid_amount),
  paymentMethod: p.payment_method as PaymentMethod,
  postToLedger: p.post_to_ledger,
  note: p.note ?? undefined,
  userId: p.user_id,
});
const toInvoice = (i: InvoiceDto): Invoice => ({
  id: i.id,
  number: i.number,
  kind: i.kind,
  date: i.date,
  branchId: i.branch_id,
  customerId: i.customer_id,
  lines: i.lines.map(
    (l): InvoiceLine => ({
      id: l.id,
      productId: l.product_id,
      variantId: l.variant_id,
      description: l.description,
      qty: num(l.qty),
      unitId: l.unit_id,
      rate: num(l.rate),
      discount: num(l.discount),
      taxable: l.taxable,
      taxRate: num(l.tax_rate),
      vatAmount: num(l.vat_amount),
    }),
  ),
  paymentMethod: i.payment_method as PaymentMethod,
  paidAmount: num(i.paid_amount),
  status: i.status,
  userId: i.user_id,
  note: i.note ?? undefined,
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
  deleteFiscalYear: (id: string) => Promise<{ ok: boolean; error?: string }>;
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
  deleteProduct: (id: string) => Promise<{ ok: boolean; error?: string }>;
  /** Upserts products (and their variants) into the global cache — used by
   *  the paginated Products page so a product on the current page is always
   *  available to app.variantsOf()/app.stockOf() even if it wasn't already
   *  in the initial full-catalog fetch. */
  syncProducts: (products: ProductDto[]) => void;
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
  createPurchase: (
    input: PurchaseInput,
  ) => Promise<{ ok: boolean; purchase?: Purchase; error?: string }>;
  addParty: (p: Omit<Party, "id">) => Promise<{ ok: boolean; party?: Party; error?: string }>;
  updateParty: (
    id: string,
    p: Omit<Party, "id" | "kind">,
  ) => Promise<{ ok: boolean; party?: Party; error?: string }>;
  deleteParty: (id: string) => Promise<{ ok: boolean; error?: string }>;

  recordPayment: (input: {
    partyId: string;
    amount: number;
    date: string;
    method: string;
    reference?: string | undefined;
  }) => Promise<{ ok: boolean; error?: string }>;
  createInvoice: (
    inv: Omit<Invoice, "id" | "number" | "userId">,
  ) => Promise<{ ok: boolean; invoice?: Invoice; error?: string }>;
  convertQuotation: (
    id: string,
    payment: { paymentMethod: PaymentMethod; paidAmount: number },
  ) => Promise<{ ok: boolean; invoice?: Invoice; error?: string }>;
  updateCompany: (patch: Partial<CompanyProfile>) => void;
  updateVatSettings: (patch: {
    vatEnabled?: boolean;
    vatRate?: number;
  }) => Promise<{ ok: boolean; error?: string }>;
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
  // Quotations stay mock-only (not built yet); everything else here is real.
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
          purchasesRes,
          invoicesRes,
        ] = await Promise.all([
          branchesApi.listMine(),
          categoriesApi.list(),
          brandsApi.list(),
          unitsApi.list(),
          mediaApi.list(),
          productsApi.list({ per_page: 100 }),
          stockApi.movements({ per_page: 100 }),
          fiscalYearsApi.list(),
          partiesApi.list(undefined, { per_page: 100 }),
          ledgerApi.listAll(),
          purchasesApi.list({ per_page: 100 }),
          invoicesApi.list({ per_page: 100 }),
        ]);
        if (cancelled) return;
        const productDtos = productsRes.data ?? [];
        const fyDtos = fiscalYearsRes.data ?? [];
        const activeFy = fyDtos.find((f) => f.is_active) ?? fyDtos[fyDtos.length - 1];
        const tenantInfo = branchesRes.meta?.tenant;
        const loadedBranches = (branchesRes.data ?? []).map(toBranch);
        setState((s) => ({
          ...s,
          company: tenantInfo ? { ...s.company, ...toCompanyPatch(tenantInfo) } : s.company,
          // No "All branches" option anymore — an owner's session starts
          // with branchId "all" (no fixed branch on their JWT) until real
          // branches load, then resolves to the first one.
          branchId: s.branchId === "all" ? (loadedBranches[0]?.id ?? "all") : s.branchId,
          branches: loadedBranches,
          categories: (categoriesRes.data ?? []).map(toCategory),
          brands: (brandsRes.data ?? []).map(toBrand),
          units: (unitsRes.data ?? []).map(toUnit),
          media: (mediaRes.data ?? []).map(toMedia),
          products: productDtos.map(toProduct),
          variants: productDtos.flatMap((p) => p.variants.map(toVariant)),
          parties: (partiesRes.data ?? []).map(toParty),
          ledger: (ledgerRes.data ?? []).map(toLedgerEntry),
          movements: (movementsRes.data ?? []).map(toMovement),
          purchases: (purchasesRes.data ?? []).map(toPurchase),
          invoices: (invoicesRes.data ?? []).map(toInvoice),
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

  // VAT-enabled/rate are per-branch (IMSBranchSettings) — refetch whenever
  // the effective branch changes, same resolution rule POS uses for "all".
  const effectiveBranchId =
    state.branchId === "all" ? (state.branches[0]?.id ?? "") : state.branchId;
  useEffect(() => {
    if (!state.currentUser || !effectiveBranchId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await branchSettingsApi.get(effectiveBranchId);
        if (cancelled || !res.success || !res.data) return;
        const settings = res.data;
        setState((s) => ({
          ...s,
          company: { ...s.company, vatRegistered: settings.vat_enabled, vatRate: num(settings.vat_rate) },
        }));
      } catch {
        // Non-fatal — VAT UI just falls back to whatever company state already had.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.currentUser?.id, effectiveBranchId]);

  const value = useMemo<AppContextValue>(() => {
    const fiscalYear =
      state.fiscalYears.find((f) => f.id === state.fiscalYearId) ??
      state.fiscalYears[state.fiscalYears.length - 1]!;

    const effectiveRole = state.viewAsRole ?? state.currentUser?.role ?? "storekeeper";
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
      deleteFiscalYear: async (id) => {
        try {
          const res = await fiscalYearsApi.remove(id);
          if (!res.success) return { ok: false, error: "Failed to delete fiscal year" };
          setState((s) => ({
            ...s,
            fiscalYears: s.fiscalYears.filter((f) => f.id !== id),
          }));
          return { ok: true };
        } catch (e) {
          return {
            ok: false,
            error: e instanceof ApiError ? e.message : "Failed to delete fiscal year",
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
          expiry_date: v.expiryDate || undefined,
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
          expiry_date: v.expiryDate || undefined,
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

      deleteProduct: async (id) => {
        try {
          const res = await productsApi.delete(id);
          if (!res.success) return { ok: false, error: "Failed to delete product" };
          setState((s) => ({
            ...s,
            products: s.products.filter((p) => p.id !== id),
            variants: s.variants.filter((v) => v.productId !== id),
          }));
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e instanceof ApiError ? e.message : "Failed to delete product" };
        }
      },

      syncProducts: (products) => {
        if (products.length === 0) return;
        setState((s) => {
          const byId = new Map(s.products.map((p) => [p.id, p]));
          for (const dto of products) byId.set(dto.id, toProduct(dto));
          const variantsById = new Map(s.variants.map((v) => [v.id, v]));
          for (const dto of products) {
            for (const vDto of dto.variants) variantsById.set(vDto.id, toVariant(vDto));
          }
          return {
            ...s,
            products: Array.from(byId.values()),
            variants: Array.from(variantsById.values()),
          };
        });
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
                ? { ...v, stock: { ...v.stock, [branchId]: num(movement.balance_after) } }
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
                ? { ...v, costPrice: unitCost, stock: { ...v.stock, [branchId]: num(movement.balance_after) } }
                : v,
            ),
            movements: [toMovement(movement), ...s.movements],
          }));
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e instanceof ApiError ? e.message : "Failed to restock" };
        }
      },

      createPurchase: async (input) => {
        const items: PurchaseItemPayload[] = input.items.map((item) =>
          item.kind === "new"
            ? {
                kind: "new",
                name: item.name,
                sku: item.sku,
                category_id: item.categoryId,
                brand_id: item.brandId,
                media_id: item.mediaId,
                taxable: item.taxable,
                tax_rate: item.taxRate,
                rows: item.rows.map((r) => ({
                  name: r.name,
                  model_no: r.modelNo,
                  barcode: r.barcode,
                  unit_id: r.unitId,
                  qty: r.qty,
                  unit_cost: r.unitCost,
                  selling_price: r.sellingPrice,
                  low_stock_at: r.lowStockAt,
                })),
              }
            : {
                kind: "existing",
                product_id: item.productId,
                rows: item.rows.map((r) => ({
                  variant_id: r.variantId,
                  qty: r.qty,
                  unit_cost: r.unitCost,
                  selling_price: r.sellingPrice,
                })),
              },
        );

        const payload: CreatePurchasePayload = {
          date: input.date,
          branch_id: input.branchId,
          party_id: input.partyId,
          bill_no: input.billNo,
          note: input.note,
          bill_amount: input.billAmount,
          paid_amount: input.paidAmount,
          payment_method: input.paymentMethod,
          post_to_ledger: input.postToLedger,
          items,
          default_vat_rate: state.company.vatRate,
        };

        try {
          const res = await purchasesApi.create(payload);
          if (!res.success || !res.data) return { ok: false, error: "Failed to record purchase" };
          const created = toPurchase(res.data);

          // A purchase can create brand-new products/variants and always
          // touches stock + (optionally) the party ledger — simplest to
          // refetch these rather than hand-reconstruct local state.
          const [productsRes, movementsRes, ledgerRes] = await Promise.all([
            productsApi.list({ per_page: 100 }),
            stockApi.movements({ per_page: 100 }),
            ledgerApi.listAll(),
          ]);
          const productDtos = productsRes.data ?? [];

          setState((s) => ({
            ...s,
            products: productDtos.map(toProduct),
            variants: productDtos.flatMap((p) => p.variants.map(toVariant)),
            movements: (movementsRes.data ?? []).map(toMovement),
            ledger: (ledgerRes.data ?? []).map(toLedgerEntry),
            purchases: [created, ...s.purchases],
          }));

          return { ok: true, purchase: created };
        } catch (e) {
          return { ok: false, error: e instanceof ApiError ? e.message : "Failed to record purchase" };
        }
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

      updateParty: async (id, p) => {
        try {
          const res = await partiesApi.update(id, {
            name: p.name,
            phone: p.phone || undefined,
            email: p.email,
            address: p.address || undefined,
            pan: p.pan,
            is_vat_registered: p.isVatRegistered,
            credit_limit: p.creditLimit,
            opening_balance: p.openingBalance,
            terms: p.terms,
          });
          if (!res.success || !res.data) return { ok: false, error: "Failed to update party" };
          const updated = toParty(res.data);
          // Opening-balance edits correct that party's "Opening balance"
          // ledger row server-side (see IMSPartyService.update) — refetch
          // just this party's ledger so the local cache matches.
          const ledgerRes = await partiesApi.ledger(id);
          const partyLedger = (ledgerRes.data ?? []).map(toLedgerEntry);
          setState((s) => ({
            ...s,
            parties: s.parties.map((party) => (party.id === id ? updated : party)),
            ledger: [...s.ledger.filter((entry) => entry.partyId !== id), ...partyLedger],
          }));
          return { ok: true, party: updated };
        } catch (e) {
          return { ok: false, error: e instanceof ApiError ? e.message : "Failed to update party" };
        }
      },

      deleteParty: async (id) => {
        try {
          const res = await partiesApi.remove(id);
          if (!res.success) return { ok: false, error: "Failed to delete party" };
          setState((s) => ({
            ...s,
            parties: s.parties.filter((party) => party.id !== id),
            ledger: s.ledger.filter((entry) => entry.partyId !== id),
          }));
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e instanceof ApiError ? e.message : "Failed to delete party" };
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

      createInvoice: async (inv) => {
        const isQuotation = inv.kind === "quotation";
        const payload: CreateInvoicePayload = {
          date: inv.date,
          branch_id: inv.branchId,
          customer_id: inv.customerId,
          payment_method: inv.paymentMethod,
          paid_amount: inv.paidAmount,
          note: inv.note,
          lines: inv.lines.map((l) => ({
            variant_id: l.variantId,
            qty: l.qty,
            rate: l.rate,
            discount: l.discount,
            taxable: l.taxable,
          })),
          vat_registered: state.company.vatRegistered,
          vat_rate: state.company.vatRate,
          invoice_prefix: state.company.invoicePrefix,
          is_quotation: isQuotation,
        };

        try {
          const res = await invoicesApi.create(payload);
          if (!res.success || !res.data) return { ok: false, error: "Failed to record sale" };
          const created = toInvoice(res.data);

          if (isQuotation) {
            // A quotation touches neither stock nor the ledger — no refetch
            // needed, just add it to local state.
            setState((s) => ({ ...s, invoices: [created, ...s.invoices] }));
            return { ok: true, invoice: created };
          }

          // A real sale always touches stock and the customer ledger —
          // refetch rather than hand-reconstruct local state, same as
          // createPurchase.
          const [productsRes, movementsRes, ledgerRes] = await Promise.all([
            productsApi.list({ per_page: 100 }),
            stockApi.movements({ per_page: 100 }),
            ledgerApi.listAll(),
          ]);
          const productDtos = productsRes.data ?? [];

          setState((s) => ({
            ...s,
            products: productDtos.map(toProduct),
            variants: productDtos.flatMap((p) => p.variants.map(toVariant)),
            movements: (movementsRes.data ?? []).map(toMovement),
            ledger: (ledgerRes.data ?? []).map(toLedgerEntry),
            invoices: [created, ...s.invoices],
          }));

          return { ok: true, invoice: created };
        } catch (e) {
          return { ok: false, error: e instanceof ApiError ? e.message : "Failed to record sale" };
        }
      },

      convertQuotation: async (id, payment) => {
        try {
          const res = await invoicesApi.convert(id, {
            payment_method: payment.paymentMethod,
            paid_amount: payment.paidAmount,
            vat_registered: state.company.vatRegistered,
            vat_rate: state.company.vatRate,
            invoice_prefix: state.company.invoicePrefix,
          });
          if (!res.success || !res.data) return { ok: false, error: "Failed to convert quotation" };
          const converted = toInvoice(res.data);

          // Conversion deducts stock and posts to the ledger for real —
          // refetch, same as a normal sale.
          const [productsRes, movementsRes, ledgerRes] = await Promise.all([
            productsApi.list({ per_page: 100 }),
            stockApi.movements({ per_page: 100 }),
            ledgerApi.listAll(),
          ]);
          const productDtos = productsRes.data ?? [];

          setState((s) => ({
            ...s,
            products: productDtos.map(toProduct),
            variants: productDtos.flatMap((p) => p.variants.map(toVariant)),
            movements: (movementsRes.data ?? []).map(toMovement),
            ledger: (ledgerRes.data ?? []).map(toLedgerEntry),
            invoices: s.invoices.map((i) => (i.id === id ? converted : i)),
          }));

          return { ok: true, invoice: converted };
        } catch (e) {
          return {
            ok: false,
            error: e instanceof ApiError ? e.message : "Failed to convert quotation",
          };
        }
      },

      updateCompany: (patch) =>
        setState((s) => ({ ...s, company: { ...s.company, ...patch } })),

      updateVatSettings: async (patch) => {
        if (!effectiveBranchId) return { ok: false, error: "No branch selected" };
        try {
          const res = await branchSettingsApi.update(effectiveBranchId, {
            vat_enabled: patch.vatEnabled,
            vat_rate: patch.vatRate,
          });
          if (!res.success || !res.data) return { ok: false, error: "Failed to update VAT settings" };
          const settings = res.data;
          setState((s) => ({
            ...s,
            company: {
              ...s.company,
              vatRegistered: settings.vat_enabled,
              vatRate: num(settings.vat_rate),
            },
          }));
          return { ok: true };
        } catch (e) {
          return {
            ok: false,
            error: e instanceof ApiError ? e.message : "Failed to update VAT settings",
          };
        }
      },
    };
  }, [state, login, logout, effectiveBranchId]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
