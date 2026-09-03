export type Role = "owner" | "manager" | "waiter" | "chef";

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  manager: "Manager",
  waiter: "Waiter",
  chef: "Chef",
};

export type Branch = { id: string; name: string; address: string; phone: string };

export type Category = { id: string; name: string };

export type Variant = { id: string; name: string; price: number };

// A combo component: one sub-item plus its variant + qty.
export type MenuItemComponent = {
  id: string;
  childMenuItemId: string;
  childVariantName?: string;
  childName: string;
  qty: number;
};

export type MenuItem = {
  id: string;
  name: string;
  categoryId: string;
  image?: string;
  hasVariants: boolean;
  // Mutually exclusive with hasVariants. When true, `price` is the combo
  // price and `components` is the composition (>=1 entries).
  isCombo: boolean;
  price?: number;
  variants: Variant[];
  components: MenuItemComponent[];
  soldOut: boolean;
};

export type Zone = { id: string; name: string };

export type TableStatus = "empty" | "occupied" | "reserved";

export type Reservation = {
  guestName: string;
  phone: string;
  date: string;
  time: string;
  partySize: number;
};

export type RestaurantTable = {
  id: string;
  label: string;
  groupId: string;
  status: TableStatus;
  mergeId?: string;
  reservation?: Reservation;
};

// Suggested categories shown in the Add-expense dropdown. Backend accepts
// any string so tenants can add their own labels later — the enum here is
// just a curation, not a hard constraint.
export const EXPENSE_CATEGORIES = [
  "Utilities",
  "Supplies",
  "Rent",
  "Maintenance",
  "Other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number] | string;

export type Expense = {
  id: string;
  // Business day the expense hits — stored server-side as `spent_at_bs`
  // ("YYYY-MM-DD" in BS). Matches order.placedAtBs so reports can filter
  // both by the same range picker.
  spentAtBs: string;
  category: string;
  amount: number;
  note: string;
  actorName: string;
};

export type DeliveryStatus = "pending" | "out" | "delivered";

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  pending: "Pending",
  out: "Out for Delivery",
  delivered: "Delivered",
};

export type OrderLine = {
  id: string;
  menuItemId: string;
  name: string;
  variantName?: string;
  price: number;
  qty: number;
  note: string;
  sent: boolean;
};

export type KitchenStatus = "new" | "cooking" | "ready" | "served";

// Slim customer view carried on an Order — matches OrderCustomerRef on the
// server. Enough to render receipts and delivery cards without a second
// fetch. Full Customer (with balance) still lives in the Customers list.
export type OrderCustomerRef = {
  id: string;
  name: string;
  phone: string;
  address: string;
};

export type Order = {
  id: string;
  // Sequential per-branch number for receipts and searches. Populated by
  // the server on create — always > 0.
  billNumber: number;
  // IRD: Electronic Billing Procedure 2082, clause 6.2ग — the actual
  // printed/displayed bill number, e.g. "RMS-KTM-83/84-00005". Use this on
  // receipts/KOT, not the plain billNumber above (which stays internal —
  // search/sort still key off it). Undefined only for a pre-migration row.
  billCode?: string;
  tableId: string;
  type: "dine-in" | "delivery";
  // Present when customer_id is set on the order — always for delivery,
  // whenever the waiter attached a customer at pay time (khata) for dine-in.
  customerId?: string;
  customer?: OrderCustomerRef;
  // Only meaningful for type='delivery'.
  deliveryStatus?: DeliveryStatus;
  lines: OrderLine[];
  status: "draft" | "paid";
  kitchenStatus: KitchenStatus;
  placedAt: number;
  // Bikram Sambat mirrors, stored server-side and passed through as strings
  // ("YYYY-MM-DD" in BS). Use these when displaying on receipts, reports,
  // and order lists so we're showing the exact date the record was stamped
  // with — not one recomputed on read.
  placedAtBs: string;
  paidAtBs?: string;
  // Only NULL for unsettled khata orders. For cash/qr this equals paidAt.
  settledAt?: number;
  settledAtBs?: string;
  discountType: "percent" | "flat";
  discountValue: number;
  paymentMethod?: "cash" | "qr" | "khata";
  enteredByName: string;
  // IRD: simplified ("abbreviated") vs full ("tax") VAT breakdown bill —
  // set at mark-paid time, undefined for a still-draft order. Display-only.
  kind?: "tax" | "abbreviated";
  buyerPan?: string;
  // IRD: Electronic Billing Procedure 2082, clause 6.2घ — Order Slip
  // sequential numbers this bill was built from (one per "send to
  // kitchen" round). Only populated when the order was fetched
  // individually or just sent to kitchen — undefined elsewhere.
  slipNumbers?: number[];
};

export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: "kg" | "liter" | "piece" | "packet";
  threshold: number;
};

export type StockMovement = {
  id: string;
  itemId: string;
  type: "restock" | "adjust";
  delta: number;
  reason: string;
  note?: string;
  cost?: number;
  by: string;
  at: number;
};

export type Employee = {
  id: string;
  name: string;
  designation: string;
  phone: string;
  email?: string;
  salary: number;
  shift: string;
  active: boolean;
};

// Khata / recurring customer. `outstandingBalance` = sum of unsettled khata
// order totals (returned by the server on customer list / detail responses).
export type Customer = {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
  outstandingBalance: number;
};

export type Settings = {
  restaurantName: string;
  branchAddress: string;
  branchPhone: string;
  vatEnabled: boolean;
  vatRate: number;
  qrImage?: string | undefined;
  cbmsRealtimeEnabled: boolean;
};

// Up to 2 decimals, only shown when actually non-zero (Rs. 100 stays whole,
// Rs. 88.5 keeps its cents) — rounding every displayed amount to a whole
// rupee independently made a VAT breakdown's parts visibly fail to add up
// (e.g. Taxable Rs 89 + VAT Rs 12 shown next to a Total of Rs 100, when the
// real values are 88.50 + 11.50).
export const NPR = (n: number) =>
  `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/** Round to 2 decimal places, correcting float noise (e.g. 450.00000000006
 *  becomes 450, not a runaway decimal tail). Every VAT conversion below
 *  returns through this so displayed/stored values are always clean. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Menu item prices are stored VAT-INCLUSIVE (what the customer actually
 *  pays) — the opposite convention from IMS's sellingPrice, chosen because
 *  that's what a menu board price means. VAT-exclusive -> inclusive. */
export function priceWithVat(exclusive: number, rate: number, taxable = true): number {
  if (!taxable) return round2(exclusive);
  return round2(exclusive + (exclusive * rate) / 100);
}

/** VAT-inclusive -> VAT-exclusive (inverse of priceWithVat). Used both by
 *  the menu item form's Excl. VAT field and by bill rendering, which shows
 *  the excl. unit price per line and adds VAT back at the bottom. */
export function priceWithoutVat(inclusive: number, rate: number, taxable = true): number {
  if (!taxable) return round2(inclusive);
  return round2(inclusive / (1 + rate / 100));
}
