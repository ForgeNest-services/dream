import type {
  Branch,
  FiscalYear,
  Brand,
  Category,
  CompanyProfile,
  Invoice,
  LedgerEntry,
  MediaItem,
  Party,
  Product,
  Purchase,
  StockMovement,
  Unit,
  User,
  Variant,
} from "./types";

import { adToBs, bsDaysInMonth, bsToAd } from "@/lib/nepali-date";

import tshirt from "@/assets/media/tshirt.jpg";
import pipeFitting from "@/assets/media/pipe-fitting.jpg";
import ledBulb from "@/assets/media/led-bulb.jpg";
import paintBucket from "@/assets/media/paint-bucket.jpg";

/** Deterministic pseudo-random so SSR and client agree. */
function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export const COMPANY: CompanyProfile = {
  name: "Srota Traders",
  legalName: "Srota Traders Pvt. Ltd.",
  pan: "301234567",
  vatRegistered: true,
  address: "Newroad, Kathmandu, Bagmati",
  phone: "+977 1 4567890",
  email: "billing@srotatraders.com.np",
  vatRate: 13,
  invoicePrefix: "SR",
};

export function makeFiscalYear(startYear: number): FiscalYear {
  return {
    id: `fy-${startYear}`,
    startYear,
    label: `${startYear}/${String((startYear + 1) % 100).padStart(2, "0")}`,
    startDate: bsToAd({ year: startYear, month: 4, day: 1 }).toISOString(),
    endDate: bsToAd({ year: startYear + 1, month: 3, day: bsDaysInMonth(startYear + 1, 3) }).toISOString(),
  };
}

export const CURRENT_FY_YEAR = (() => {
  const now = adToBs(new Date());
  return now.month >= 4 ? now.year : now.year - 1;
})();

export function buildFiscalYears(): FiscalYear[] {
  const now = adToBs(new Date());
  const current = CURRENT_FY_YEAR;
  void now;
  return [current - 2, current - 1, current].map(makeFiscalYear);
}

export const BRANCHES: Branch[] = [
  { id: "br-ktm", name: "Kathmandu — Main", code: "KTM", address: "Newroad, Kathmandu" },
  { id: "br-pkr", name: "Pokhara Store", code: "PKR", address: "Lakeside, Pokhara" },
  { id: "br-btl", name: "Butwal Depot", code: "BTL", address: "Traffic Chowk, Butwal" },
];

export const USERS: User[] = [
  {
    id: "u-1",
    username: "owner",
    name: "Suraj Shrestha",
    role: "owner",
    branchIds: BRANCHES.map((b) => b.id),
    active: true,
  },
  {
    id: "u-2",
    username: "manager",
    name: "Anita Gurung",
    role: "manager",
    branchIds: ["br-ktm"],
    active: true,
  },
  {
    id: "u-3",
    username: "store",
    name: "Bikash Tamang",
    role: "storekeeper",
    branchIds: ["br-ktm"],
    active: true,
  },
];

export const UNITS: Unit[] = [
  { id: "un-pcs", name: "Pieces", symbol: "pcs", allowsDecimals: false },
  { id: "un-box", name: "Box", symbol: "box", allowsDecimals: false },
  { id: "un-kg", name: "Kilogram", symbol: "kg", allowsDecimals: true },
  { id: "un-bag", name: "Bag", symbol: "bag", allowsDecimals: false },
  { id: "un-ltr", name: "Litre", symbol: "ltr", allowsDecimals: true },
  { id: "un-mtr", name: "Metre", symbol: "m", allowsDecimals: true },
  { id: "un-roll", name: "Roll", symbol: "roll", allowsDecimals: false },
  { id: "un-set", name: "Set", symbol: "set", allowsDecimals: false },
];

export const CATEGORIES: Category[] = [
  { id: "c-app", name: "Apparel", parentId: null },
  { id: "c-app-men", name: "Menswear", parentId: "c-app" },
  { id: "c-app-men-top", name: "T-Shirts", parentId: "c-app-men" },
  { id: "c-app-women", name: "Womenswear", parentId: "c-app" },
  { id: "c-ele", name: "Electricals", parentId: null },
  { id: "c-ele-light", name: "Lighting", parentId: "c-ele" },
  { id: "c-ele-wire", name: "Wires & Cables", parentId: "c-ele" },
  { id: "c-hw", name: "Hardware", parentId: null },
  { id: "c-hw-pipe", name: "Pipes & Fittings", parentId: "c-hw" },
  { id: "c-hw-paint", name: "Paints", parentId: "c-hw" },
  { id: "c-gro", name: "Grocery", parentId: null },
  { id: "c-gro-grain", name: "Grains & Pulses", parentId: "c-gro" },
];

export const BRANDS: Brand[] = [
  { id: "b-1", name: "Everest" },
  { id: "b-2", name: "Surya" },
  { id: "b-3", name: "Nepa Poly" },
  { id: "b-4", name: "Lumino" },
  { id: "b-5", name: "Annapurna" },
];

export const MEDIA: MediaItem[] = [
  {
    id: "m-1",
    name: "cotton-tshirt.jpg",
    url: tshirt,
    folder: "Apparel",
    sizeKb: 184,
    uploadedAt: daysAgo(40),
  },
  {
    id: "m-2",
    name: "pvc-fittings.jpg",
    url: pipeFitting,
    folder: "Hardware",
    sizeKb: 212,
    uploadedAt: daysAgo(35),
  },
  {
    id: "m-3",
    name: "led-bulb.jpg",
    url: ledBulb,
    folder: "Electricals",
    sizeKb: 156,
    uploadedAt: daysAgo(28),
  },
  {
    id: "m-4",
    name: "paint-bucket.jpg",
    url: paintBucket,
    folder: "Hardware",
    sizeKb: 198,
    uploadedAt: daysAgo(12),
  },
];

interface ProductSeed {
  id: string;
  name: string;
  sku: string;
  categoryId: string;
  brandId?: string;
  mediaId?: string;
  unitId: string;
  purchaseUnitId?: string;
  conversionFactor?: number;
  variants: { name: string; model: string; cost: number; price: number }[];
}

const PRODUCT_SEEDS: ProductSeed[] = [
  {
    id: "p-1",
    name: "Cotton Round-Neck T-Shirt",
    sku: "APP-TS-001",
    categoryId: "c-app-men-top",
    brandId: "b-1",
    mediaId: "m-1",
    unitId: "un-pcs",
    purchaseUnitId: "un-box",
    conversionFactor: 12,
    variants: [
      { name: "S / Black", model: "TS-S-BK", cost: 480, price: 799 },
      { name: "M / Black", model: "TS-M-BK", cost: 480, price: 799 },
      { name: "L / Black", model: "TS-L-BK", cost: 500, price: 849 },
      { name: "M / White", model: "TS-M-WH", cost: 480, price: 799 },
    ],
  },
  {
    id: "p-2",
    name: "PVC Elbow 90° 1/2 inch",
    sku: "HW-PE-050",
    categoryId: "c-hw-pipe",
    brandId: "b-3",
    mediaId: "m-2",
    unitId: "un-pcs",
    purchaseUnitId: "un-box",
    conversionFactor: 50,
    variants: [
      { name: "Class B", model: "PE-B-050", cost: 22, price: 39 },
      { name: "Class C", model: "PE-C-050", cost: 28, price: 49 },
    ],
  },
  {
    id: "p-3",
    name: "LED Bulb 9W Cool White",
    sku: "ELE-LB-009",
    categoryId: "c-ele-light",
    brandId: "b-4",
    mediaId: "m-3",
    unitId: "un-pcs",
    purchaseUnitId: "un-box",
    conversionFactor: 24,
    variants: [{ name: "Default", model: "LB-9W-CW", cost: 105, price: 199 }],
  },
  {
    id: "p-4",
    name: "Interior Emulsion Paint",
    sku: "HW-PT-100",
    categoryId: "c-hw-paint",
    brandId: "b-2",
    mediaId: "m-4",
    unitId: "un-ltr",
    variants: [
      { name: "Ivory 4L", model: "PT-IV-4", cost: 1250, price: 1899 },
      { name: "Ivory 20L", model: "PT-IV-20", cost: 5900, price: 8499 },
      { name: "Sky Blue 4L", model: "PT-SB-4", cost: 1290, price: 1949 },
    ],
  },
  {
    id: "p-5",
    name: "Basmati Rice",
    sku: "GRO-RC-025",
    categoryId: "c-gro-grain",
    brandId: "b-5",
    unitId: "un-kg",
    purchaseUnitId: "un-bag",
    conversionFactor: 25,
    variants: [
      { name: "Premium", model: "RC-PRM", cost: 118, price: 155 },
      { name: "Standard", model: "RC-STD", cost: 96, price: 129 },
    ],
  },
  {
    id: "p-6",
    name: "Copper Wire 2.5 sq.mm",
    sku: "ELE-WR-025",
    categoryId: "c-ele-wire",
    brandId: "b-2",
    unitId: "un-mtr",
    purchaseUnitId: "un-roll",
    conversionFactor: 90,
    variants: [
      { name: "Red", model: "WR-25-RD", cost: 42, price: 65 },
      { name: "Black", model: "WR-25-BK", cost: 42, price: 65 },
      { name: "Green", model: "WR-25-GR", cost: 44, price: 69 },
    ],
  },
  {
    id: "p-7",
    name: "Ladies Kurtha Set",
    sku: "APP-KU-010",
    categoryId: "c-app-women",
    brandId: "b-1",
    unitId: "un-set",
    variants: [
      { name: "Free / Maroon", model: "KU-F-MR", cost: 1450, price: 2299 },
      { name: "Free / Teal", model: "KU-F-TL", cost: 1450, price: 2299 },
    ],
  },
  {
    id: "p-8",
    name: "PVC Pipe 1 inch (Class C)",
    sku: "HW-PP-100",
    categoryId: "c-hw-pipe",
    brandId: "b-3",
    mediaId: "m-2",
    unitId: "un-mtr",
    variants: [{ name: "Default", model: "PP-C-100", cost: 96, price: 145 }],
  },
  {
    id: "p-9",
    name: "LED Panel Light 18W",
    sku: "ELE-PL-018",
    categoryId: "c-ele-light",
    brandId: "b-4",
    mediaId: "m-3",
    unitId: "un-pcs",
    variants: [
      { name: "Round", model: "PL-18-RD", cost: 420, price: 699 },
      { name: "Square", model: "PL-18-SQ", cost: 430, price: 719 },
    ],
  },
  {
    id: "p-10",
    name: "Masoor Dal",
    sku: "GRO-DL-001",
    categoryId: "c-gro-grain",
    brandId: "b-5",
    unitId: "un-kg",
    purchaseUnitId: "un-bag",
    conversionFactor: 30,
    variants: [{ name: "Default", model: "DL-MSR", cost: 148, price: 189 }],
  },
];

export function buildProducts(): { products: Product[]; variants: Variant[] } {
  const rand = lcg(77);
  const products: Product[] = [];
  const variants: Variant[] = [];
  PRODUCT_SEEDS.forEach((seed, i) => {
    products.push({
      id: seed.id,
      name: seed.name,
      sku: seed.sku,
      categoryId: seed.categoryId,
      brandId: seed.brandId,
      mediaId: seed.mediaId,
      description: "",
      createdAt: daysAgo(90 - i * 5),
    });
    seed.variants.forEach((v, vi) => {
      variants.push({
        id: `${seed.id}-v${vi + 1}`,
        productId: seed.id,
        name: v.name,
        modelNo: v.model,
        barcode: `978${String(100000 + i * 37 + vi * 11)}`,
        unitId: seed.unitId,
        purchaseUnitId: seed.purchaseUnitId,
        conversionFactor: seed.conversionFactor,
        costPrice: v.cost,
        sellingPrice: v.price,
        stock: {
          "br-ktm": Math.floor(rand() * 120) + 4,
          "br-pkr": Math.floor(rand() * 60),
          "br-btl": Math.floor(rand() * 40),
        },
        lowStockAt: 10,
      });
    });
  });
  return { products, variants };
}

export const PARTIES: Party[] = [
  {
    id: "s-1",
    name: "Nepa Poly Industries",
    kind: "supplier",
    phone: "+977 1 5551020",
    address: "Balaju, Kathmandu",
    pan: "600112233",
    isVatRegistered: true,
    openingBalance: 125000,
    terms: "Net 30",
  },
  {
    id: "s-2",
    name: "Surya Electricals Supply",
    kind: "supplier",
    phone: "+977 1 5559080",
    address: "Teku, Kathmandu",
    pan: "600445566",
    isVatRegistered: true,
    openingBalance: 48000,
    terms: "Net 15",
  },
  {
    id: "s-3",
    name: "Annapurna Foods",
    kind: "supplier",
    phone: "+977 61 445566",
    address: "Pokhara",
    pan: "600778899",
    isVatRegistered: false,
    openingBalance: 0,
    terms: "Cash",
  },
  {
    id: "s-4",
    name: "Everest Garments",
    kind: "supplier",
    phone: "+977 1 5512340",
    address: "Gongabu, Kathmandu",
    pan: "600334455",
    isVatRegistered: true,
    openingBalance: 76500,
    terms: "Net 45",
  },
  {
    id: "c-1",
    name: "Sagarmatha Builders",
    kind: "customer",
    phone: "+977 9801234567",
    address: "Baneshwor, Kathmandu",
    pan: "500998877",
    isVatRegistered: true,
    creditLimit: 500000,
    openingBalance: 35000,
  },
  {
    id: "c-2",
    name: "Rita Maharjan",
    kind: "customer",
    phone: "+977 9812345678",
    address: "Patan, Lalitpur",
    creditLimit: 25000,
    openingBalance: 0,
  },
  {
    id: "c-3",
    name: "Lakeside Hotel Pvt. Ltd.",
    kind: "customer",
    phone: "+977 61 992211",
    address: "Lakeside, Pokhara",
    pan: "500223344",
    isVatRegistered: true,
    creditLimit: 300000,
    openingBalance: 0,
  },
  {
    id: "c-4",
    name: "Walk-in Customer",
    kind: "customer",
    phone: "-",
    address: "-",
    openingBalance: 0,
  },
  {
    id: "c-5",
    name: "Deepak Hardware Store",
    kind: "customer",
    phone: "+977 9856001122",
    address: "Butwal",
    pan: "500556677",
    isVatRegistered: true,
    creditLimit: 150000,
    openingBalance: 12500,
  },
];

export function buildMovements(variants: Variant[]): StockMovement[] {
  const rand = lcg(19);
  const out: StockMovement[] = [];
  const suppliers = ["s-1", "s-2", "s-3", "s-4"];
  for (let i = 0; i < 44; i++) {
    const v = variants[Math.floor(rand() * variants.length)]!;
    const branchId = BRANCHES[Math.floor(rand() * BRANCHES.length)]!.id;
    const roll = rand();
    const type =
      roll < 0.45 ? "restock" : roll < 0.6 ? "adjust-in" : roll < 0.75 ? "adjust-out" : "sale";
    const qty =
      type === "restock"
        ? Math.floor(rand() * 60) + 10
        : type === "adjust-in"
          ? Math.floor(rand() * 8) + 1
          : -(Math.floor(rand() * 6) + 1);
    out.push({
      id: `mv-${i + 1}`,
      date: daysAgo(Math.floor(rand() * 70)),
      branchId,
      productId: v.productId,
      variantId: v.id,
      type: type as StockMovement["type"],
      qty,
      unitCost: type === "restock" ? v.costPrice : undefined,
      balanceAfter: (v.stock[branchId] ?? 0) + Math.floor(rand() * 10),
      reason:
        type === "adjust-out"
          ? ["Damaged in transit", "Stock count correction", "Sample issued"][
              Math.floor(rand() * 3)
            ]
          : type === "adjust-in"
            ? "Stock count correction"
            : undefined,
      reference: type === "restock" ? `PB-${2200 + i}` : undefined,
      supplierId: type === "restock" ? suppliers[Math.floor(rand() * 4)] : undefined,
      userId: USERS[Math.floor(rand() * USERS.length)]!.id,
    });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function buildInvoices(variants: Variant[]): Invoice[] {
  const rand = lcg(53);
  const customers = PARTIES.filter((p) => p.kind === "customer");
  const invoices: Invoice[] = [];
  for (let i = 0; i < 26; i++) {
    const lineCount = Math.floor(rand() * 3) + 1;
    const lines = Array.from({ length: lineCount }, (_, li) => {
      const v = variants[Math.floor(rand() * variants.length)]!;
      return {
        id: `il-${i}-${li}`,
        productId: v.productId,
        variantId: v.id,
        description: v.name,
        qty: Math.floor(rand() * 6) + 1,
        unitId: v.unitId,
        rate: v.sellingPrice,
        discount: rand() < 0.2 ? Math.round(v.sellingPrice * 0.05) : 0,
      };
    });
    const total = lines.reduce((s, l) => s + (l.rate - l.discount) * l.qty, 0);
    const payRoll = rand();
    const status = payRoll < 0.62 ? "paid" : payRoll < 0.82 ? "partial" : "unpaid";
    const isQuote = i >= 22;
    invoices.push({
      id: `inv-${i + 1}`,
      number: isQuote
        ? `QT-${String(1001 + i)}`
        : `${COMPANY.invoicePrefix}-${CURRENT_FY_YEAR}-${String(1001 + i)}`,
      kind: isQuote ? "quotation" : rand() < 0.7 ? "tax" : "abbreviated",
      date: daysAgo(Math.floor(rand() * 60)),
      branchId: BRANCHES[Math.floor(rand() * BRANCHES.length)]!.id,
      customerId: customers[Math.floor(rand() * customers.length)]!.id,
      lines,
      paymentMethod: rand() < 0.5 ? "cash" : rand() < 0.8 ? "qr" : "credit",
      paidAmount: status === "paid" ? total : status === "partial" ? Math.round(total * 0.5) : 0,
      status: isQuote ? "unpaid" : (status as Invoice["status"]),
      userId: USERS[Math.floor(rand() * USERS.length)]!.id,
    });
  }
  return invoices.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function buildLedger(movements: StockMovement[], invoices: Invoice[]): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  PARTIES.filter((p) => p.openingBalance !== 0).forEach((p) => {
    // Suppliers: opening payable => credit. Customers: opening receivable => debit.
    const isSupplier = p.kind === "supplier";
    entries.push({
      id: `le-open-${p.id}`,
      partyId: p.id,
      date: daysAgo(120),
      description: "Opening balance",
      debit: isSupplier ? 0 : p.openingBalance,
      credit: isSupplier ? p.openingBalance : 0,
    });
  });
  movements
    .filter((m) => m.type === "restock" && m.supplierId)
    .forEach((m, i) => {
      const amount = Math.round((m.unitCost ?? 0) * m.qty);
      entries.push({
        id: `le-p-${m.id}`,
        partyId: m.supplierId!,
        date: m.date,
        description: "Purchase — goods received",
        reference: m.reference,
        debit: 0,
        credit: amount,
      });
      if (i % 3 === 0) {
        entries.push({
          id: `le-pay-${m.id}`,
          partyId: m.supplierId!,
          date: m.date,
          description: "Payment made (bank transfer)",
          reference: `PMT-${1000 + i}`,
          debit: Math.round(amount * 0.6),
          credit: 0,
        });
      }
    });
  invoices
    .filter((inv) => inv.kind !== "quotation")
    .forEach((inv) => {
      const total = inv.lines.reduce((s, l) => s + (l.rate - l.discount) * l.qty, 0);
      entries.push({
        id: `le-s-${inv.id}`,
        partyId: inv.customerId,
        date: inv.date,
        description: `Sales invoice ${inv.number}`,
        reference: inv.number,
        debit: total,
        credit: 0,
      });
      if (inv.paidAmount > 0) {
        entries.push({
          id: `le-sp-${inv.id}`,
          partyId: inv.customerId,
          date: inv.date,
          description: `Payment received (${inv.paymentMethod})`,
          reference: inv.number,
          debit: 0,
          credit: inv.paidAmount,
        });
      }
    });
  return entries.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function createSeedData() {
  const { products, variants } = buildProducts();
  const movements = buildMovements(variants);
  const invoices = buildInvoices(variants);
  const ledger = buildLedger(movements, invoices);
  const fiscalYears = buildFiscalYears();
  return {
    company: COMPANY,
    fiscalYears,
    branches: BRANCHES,
    users: USERS,
    units: UNITS,
    categories: CATEGORIES,
    brands: BRANDS,
    media: MEDIA,
    products,
    variants,
    parties: PARTIES,
    movements,
    invoices,
    purchases: [] as Purchase[],
    ledger,
  };
}

export type SeedData = ReturnType<typeof createSeedData>;
