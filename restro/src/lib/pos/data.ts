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

export type DeliveryInfo = {
  customerName: string;
  phone: string;
  address: string;
  status: DeliveryStatus;
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

export type Order = {
  id: string;
  tableId: string;
  type: "dine-in" | "delivery";
  delivery?: DeliveryInfo;
  lines: OrderLine[];
  status: "draft" | "paid";
  kitchenStatus: KitchenStatus;
  placedAt: number;
  discountType: "percent" | "flat";
  discountValue: number;
  paymentMethod?: "cash" | "qr" | "card";
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

export const INVENTORY: InventoryItem[] = [
  { id: "i1", name: "Buff Keema", category: "Meat", stock: 12, unit: "kg", threshold: 10 },
  { id: "i2", name: "Chicken Breast", category: "Meat", stock: 6, unit: "kg", threshold: 8 },
  { id: "i3", name: "Cooking Oil", category: "Grocery", stock: 24, unit: "liter", threshold: 10 },
  { id: "i4", name: "Maida (Flour)", category: "Grocery", stock: 45, unit: "kg", threshold: 20 },
  { id: "i5", name: "Milk", category: "Dairy", stock: 3, unit: "liter", threshold: 15 },
  { id: "i6", name: "Hookah Coal", category: "Hookah", stock: 0, unit: "packet", threshold: 5 },
  { id: "i7", name: "Coca Cola 250ml", category: "Beverage", stock: 96, unit: "piece", threshold: 24 },
  { id: "i8", name: "Tea Leaves", category: "Grocery", stock: 4, unit: "kg", threshold: 5 },
];

export const EMPLOYEES: Employee[] = [
  { id: "e1", name: "Suman Shrestha", designation: "Manager", phone: "9801234567", salary: 45000, shift: "9:00 AM - 6:00 PM", active: true },
  { id: "e2", name: "Bina Tamang", designation: "Waiter", phone: "9812345678", salary: 22000, shift: "11:00 AM - 9:00 PM", active: true },
  { id: "e3", name: "Ramesh Gurung", designation: "Waiter", phone: "9843211234", salary: 21000, shift: "2:00 PM - 11:00 PM", active: true },
  { id: "e4", name: "Kiran Magar", designation: "Chef", phone: "9856781234", salary: 38000, shift: "10:00 AM - 8:00 PM", active: true },
  { id: "e5", name: "Anita Rai", designation: "Cashier", phone: "9800011223", salary: 25000, shift: "12:00 PM - 9:00 PM", active: false },
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
