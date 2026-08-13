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

export type MenuItem = {
  id: string;
  name: string;
  categoryId: string;
  image?: string;
  hasVariants: boolean;
  price?: number;
  variants: Variant[];
  soldOut: boolean;
};

export type Zone = { id: string; name: string };

export const DEFAULT_ZONES: Zone[] = [
  { id: "z1", name: "Floor 1" },
  { id: "z2", name: "Floor 2" },
  { id: "z3", name: "Top Floor" },
];

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

export type ExpenseCategory = "Utilities" | "Supplies" | "Rent" | "Maintenance" | "Other";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Utilities",
  "Supplies",
  "Rent",
  "Maintenance",
  "Other",
];

export type Expense = {
  id: string;
  date: string;
  category: ExpenseCategory;
  amount: number;
  note: string;
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
  waiter: string;
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
};

export const BRANCHES: Branch[] = [
  { id: "b1", name: "Thamel Branch", address: "Thamel Marg, Kathmandu", phone: "01-4412345" },
  { id: "b2", name: "Lakeside Branch", address: "Lakeside 6, Pokhara", phone: "061-456789" },
  { id: "b3", name: "Patan Branch", address: "Pulchowk, Lalitpur", phone: "01-5523311" },
];

export const CATEGORIES: Category[] = [
  { id: "c1", name: "Hot Beverages" },
  { id: "c2", name: "Cold Beverages / Refreshers" },
  { id: "c3", name: "Hookah" },
  { id: "c4", name: "Fast Food" },
  { id: "c5", name: "Momo" },
  { id: "c6", name: "Thakali Set" },
  { id: "c7", name: "Newari Khaja" },
];

const v = (name: string, price: number): Variant => ({
  id: `${name}-${price}-${Math.random().toString(36).slice(2, 7)}`,
  name,
  price,
});

export const MENU_ITEMS: MenuItem[] = [
  { id: "m1", name: "Milk Tea", categoryId: "c1", hasVariants: false, price: 60, variants: [], soldOut: false },
  { id: "m2", name: "Black Coffee", categoryId: "c1", hasVariants: false, price: 90, variants: [], soldOut: false },
  { id: "m3", name: "Masala Tea", categoryId: "c1", hasVariants: false, price: 80, variants: [], soldOut: false },
  { id: "m4", name: "Hot Lemon Honey Ginger", categoryId: "c1", hasVariants: false, price: 120, variants: [], soldOut: false },
  { id: "m5", name: "Cold Coffee", categoryId: "c2", hasVariants: false, price: 220, variants: [], soldOut: false },
  { id: "m6", name: "Mojito", categoryId: "c2", hasVariants: true, variants: [v("Classic", 250), v("Blue Lagoon", 280), v("Green Apple", 280)], soldOut: false },
  { id: "m7", name: "Lassi", categoryId: "c2", hasVariants: true, variants: [v("Plain", 150), v("Banana", 180), v("Mango", 190)], soldOut: false },
  { id: "m8", name: "Hookah", categoryId: "c3", hasVariants: true, variants: [v("Mint", 700), v("Double Apple", 750), v("Blueberry", 800)], soldOut: false },
  { id: "m9", name: "Extra Coal", categoryId: "c3", hasVariants: false, price: 100, variants: [], soldOut: true },
  { id: "m10", name: "Chicken Burger", categoryId: "c4", hasVariants: false, price: 350, variants: [], soldOut: false },
  { id: "m11", name: "French Fries", categoryId: "c4", hasVariants: true, variants: [v("Plain", 180), v("Peri Peri", 220), v("Cheesy", 260)], soldOut: false },
  { id: "m12", name: "Chicken Sandwich", categoryId: "c4", hasVariants: false, price: 300, variants: [], soldOut: false },
  { id: "m13", name: "Steam Momo", categoryId: "c5", hasVariants: true, variants: [v("Veg", 160), v("Chicken", 200), v("Buff", 180), v("Pork", 220)], soldOut: false },
  { id: "m14", name: "Jhol Momo", categoryId: "c5", hasVariants: true, variants: [v("Veg", 200), v("Chicken", 250), v("Buff", 230)], soldOut: false },
  { id: "m15", name: "C Momo", categoryId: "c5", hasVariants: true, variants: [v("Chicken", 280), v("Buff", 260)], soldOut: false },
  { id: "m16", name: "Thakali Khana Set", categoryId: "c6", hasVariants: true, variants: [v("Veg", 350), v("Chicken", 480), v("Mutton", 650)], soldOut: false },
  { id: "m17", name: "Dal Bhat Special", categoryId: "c6", hasVariants: false, price: 420, variants: [], soldOut: false },
  { id: "m18", name: "Newari Khaja Set", categoryId: "c7", hasVariants: true, variants: [v("Buff", 450), v("Chicken", 420)], soldOut: false },
  { id: "m19", name: "Choila", categoryId: "c7", hasVariants: true, variants: [v("Buff", 350), v("Chicken", 320)], soldOut: false },
  { id: "m20", name: "Bara", categoryId: "c7", hasVariants: false, price: 150, variants: [], soldOut: false },
];

export const SALES_TREND = [
  { day: "Sun", sales: 42500 },
  { day: "Mon", sales: 38900 },
  { day: "Tue", sales: 51200 },
  { day: "Wed", sales: 47800 },
  { day: "Thu", sales: 62300 },
  { day: "Fri", sales: 78400 },
  { day: "Sat", sales: 91200 },
];

export const TOP_ITEMS = [
  { name: "Steam Momo (Buff)", qty: 84, revenue: 15120 },
  { name: "Thakali Set (Chicken)", qty: 47, revenue: 22560 },
  { name: "Hookah (Double Apple)", qty: 29, revenue: 21750 },
  { name: "Milk Tea", qty: 112, revenue: 6720 },
  { name: "Chicken Burger", qty: 33, revenue: 11550 },
];

export const CATEGORY_SALES = [
  { category: "Momo", amount: 42300 },
  { category: "Thakali Set", amount: 38900 },
  { category: "Hookah", amount: 27400 },
  { category: "Fast Food", amount: 19800 },
  { category: "Hot Beverages", amount: 12600 },
  { category: "Newari Khaja", amount: 16400 },
  { category: "Cold Beverages / Refreshers", amount: 9800 },
];

export function makeTables(zones: Zone[] = DEFAULT_ZONES, counts: number[] = [8, 6, 4]): RestaurantTable[] {
  return zones.flatMap((z, zi) =>
    Array.from({ length: counts[zi] ?? 6 }, (_, i) => ({
      id: `${z.id}-t${i + 1}`,
      label: `T${i + 1}`,
      groupId: z.id,
      status: "empty" as TableStatus,
    })),
  );
}

export const NPR = (n: number) =>
  `Rs. ${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export const EXPENSES: Expense[] = [
  { id: "x1", date: new Date().toISOString().slice(0, 10), category: "Utilities", amount: 8400, note: "Electricity bill" },
  { id: "x2", date: new Date(Date.now() - 864e5).toISOString().slice(0, 10), category: "Supplies", amount: 15200, note: "Vegetables & dairy" },
  { id: "x3", date: new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10), category: "Rent", amount: 65000, note: "Monthly shop rent" },
  { id: "x4", date: new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10), category: "Maintenance", amount: 4300, note: "Fridge servicing" },
  { id: "x5", date: new Date(Date.now() - 4 * 864e5).toISOString().slice(0, 10), category: "Other", amount: 2200, note: "Staff tea" },
];
