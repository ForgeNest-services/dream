export type Role = "owner" | "manager" | "storekeeper" | "cashier" | "accountant";

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  manager: "Manager",
  storekeeper: "Store Keeper",
  cashier: "Cashier",
  accountant: "Accountant",
};

export type ModuleKey =
  | "dashboard"
  | "inventory"
  | "purchase"
  | "sales"
  | "parties"
  | "reports"
  | "settings";

export const ROLE_MODULES: Record<Role, ModuleKey[]> = {
  owner: ["dashboard", "inventory", "purchase", "sales", "parties", "reports", "settings"],
  manager: ["dashboard", "inventory", "purchase", "sales", "parties", "reports"],
  storekeeper: ["dashboard", "inventory", "purchase"],
  cashier: ["dashboard", "sales", "parties"],
  accountant: ["dashboard", "parties", "reports"],
};

export type Permission =
  | "product.edit"
  | "stock.adjust"
  | "stock.restock"
  | "purchase.create"
  | "sale.create"
  | "payment.record"
  | "report.view"
  | "settings.manage"
  | "branch.all";

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [
    "product.edit",
    "stock.adjust",
    "stock.restock",
    "purchase.create",
    "sale.create",
    "payment.record",
    "report.view",
    "settings.manage",
    "branch.all",
  ],
  manager: [
    "product.edit",
    "stock.adjust",
    "stock.restock",
    "purchase.create",
    "sale.create",
    "payment.record",
    "report.view",
  ],
  storekeeper: ["product.edit", "stock.adjust", "stock.restock", "purchase.create"],
  cashier: ["sale.create", "payment.record"],
  accountant: ["payment.record", "report.view"],
};

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  branchIds: string[];
  active: boolean;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
}

export interface MediaItem {
  id: string;
  name: string;
  url: string;
  folder: string;
  sizeKb: number;
  uploadedAt: string; // ISO
}

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
}

export interface Brand {
  id: string;
  name: string;
}

export interface Unit {
  id: string;
  name: string;
  symbol: string;
  allowsDecimals: boolean;
}

export interface Variant {
  id: string;
  productId: string;
  name: string;
  modelNo: string;
  barcode: string;
  unitId: string;
  /** optional purchase unit conversion, e.g. 1 box = 12 pcs */
  purchaseUnitId?: string | undefined;
  conversionFactor?: number | undefined;
  costPrice: number;
  sellingPrice: number;
  /** stock per branch id */
  stock: Record<string, number>;
  lowStockAt: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  categoryId: string;
  brandId?: string | undefined;
  mediaId?: string | undefined;
  description?: string | undefined;
  /** VAT treatment — taxable items attract VAT for VAT-registered companies.
   *  Undefined is treated as taxable. */
  taxable?: boolean | undefined;
  createdAt: string;
}

export type MovementType = "restock" | "adjust-in" | "adjust-out" | "sale" | "transfer";

export interface StockMovement {
  id: string;
  date: string; // ISO
  branchId: string;
  productId: string;
  variantId: string;
  type: MovementType;
  qty: number; // signed, in base unit
  unitCost?: number | undefined;
  balanceAfter: number;
  reason?: string | undefined;
  reference?: string | undefined;
  supplierId?: string | undefined;
  userId: string;
}

export interface Party {
  id: string;
  name: string;
  kind: "supplier" | "customer";
  phone: string;
  email?: string | undefined;
  address: string;
  pan?: string | undefined;
  isVatRegistered?: boolean | undefined;
  creditLimit?: number | undefined;
  openingBalance: number;
  terms?: string | undefined;
}

export interface LedgerEntry {
  id: string;
  partyId: string;
  date: string;
  description: string;
  reference?: string | undefined;
  debit: number;
  credit: number;
}

export type PaymentMethod = "cash" | "qr" | "bank" | "credit";

export interface InvoiceLine {
  id: string;
  productId: string;
  variantId: string;
  description: string;
  qty: number;
  unitId: string;
  rate: number; // VAT inclusive when company is VAT registered
  discount: number;
  /** false = VAT exempt / non-taxable item. Undefined is treated as taxable. */
  taxable?: boolean | undefined;
}

export type InvoiceStatus = "paid" | "partial" | "unpaid" | "cancelled";

export interface Invoice {
  id: string;
  number: string;
  kind: "tax" | "abbreviated" | "quotation";
  date: string;
  branchId: string;
  customerId: string;
  lines: InvoiceLine[];
  paymentMethod: PaymentMethod;
  paidAmount: number;
  status: InvoiceStatus;
  userId: string;
  note?: string | undefined;
  isCopy?: boolean | undefined;
}

export interface CompanyProfile {
  name: string;
  legalName: string;
  pan: string;
  vatRegistered: boolean;
  address: string;
  phone: string;
  email: string;
  vatRate: number;
  invoicePrefix: string;
  qrImageUrl?: string | undefined;
}

export type DateSystem = "BS" | "AD";

export interface FiscalYear {
  id: string;
  /** BS start year, e.g. 2083 for FY 2083/84 */
  startYear: number;
  label: string; // "2083/84"
  startDate: string; // ISO (AD) of Shrawan 1
  endDate: string; // ISO (AD) of Ashad end
}

export interface PurchaseLine {
  id: string;
  productId: string;
  variantId: string;
  description: string;
  qty: number;
  unitId: string;
  unitCost: number;
}

export interface Purchase {
  id: string;
  number: string;
  date: string;
  branchId: string;
  /** optional — purchases can be recorded without a party */
  partyId?: string | undefined;
  /** supplier's bill / invoice number */
  billNo?: string | undefined;
  lines: PurchaseLine[];
  /** sum of qty × unit cost of the entered items */
  itemsTotal: number;
  /** manually entered bill amount that is posted to the party ledger */
  billAmount: number;
  paidAmount: number;
  paymentMethod: PaymentMethod;
  /** when false nothing is posted to the party ledger */
  postToLedger: boolean;
  note?: string | undefined;
  userId: string;
}
