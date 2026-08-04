export type RoomStatus = "available" | "occupied" | "cleaning" | "maintenance";
export type BookingStatus = "reserved" | "checked-in" | "checked-out" | "cancelled";

export const roomStatusLabel: Record<RoomStatus, string> = {
  available: "Available",
  occupied: "Occupied",
  cleaning: "Cleaning",
  maintenance: "Maintenance",
};

export const roomStatusClass: Record<RoomStatus, string> = {
  available: "bg-success/12 text-success border-success/25",
  occupied: "bg-accent/12 text-accent border-accent/25",
  cleaning: "bg-info/12 text-info border-info/25",
  maintenance: "bg-amber/15 text-amber-foreground border-amber/40",
};

export const bookingStatusClass: Record<BookingStatus, string> = {
  reserved: "bg-info/12 text-info border-info/25",
  "checked-in": "bg-success/12 text-success border-success/25",
  "checked-out": "bg-muted text-muted-foreground border-border",
  cancelled: "bg-destructive/10 text-destructive border-destructive/25",
};

export type Room = {
  id: string;
  number: string;
  type: string;
  floor: number;
  rate: number;
  status: RoomStatus;
};

export const roomTypes = [
  { id: "rt1", name: "Standard Double", baseRate: 4500, capacity: 2, count: 14 },
  { id: "rt2", name: "Deluxe King", baseRate: 7200, capacity: 2, count: 10 },
  { id: "rt3", name: "Twin Executive", baseRate: 6400, capacity: 3, count: 8 },
  { id: "rt4", name: "Himalaya Suite", baseRate: 14500, capacity: 4, count: 4 },
];

const statuses: RoomStatus[] = ["available", "occupied", "cleaning", "maintenance"];

export const rooms: Room[] = Array.from({ length: 36 }, (_, i) => {
  const floor = Math.floor(i / 12) + 1;
  const type = roomTypes[i % roomTypes.length]!;
  const status = statuses[(i * 7 + floor) % 4 === 3 && i % 5 !== 0 ? 0 : (i * 3) % 4]!;
  return {
    id: `r${i + 1}`,
    number: `${floor}${String((i % 12) + 1).padStart(2, "0")}`,
    type: type.name,
    floor,
    rate: type.baseRate,
    status,
  };
});

export type Booking = {
  id: string;
  ref: string;
  guest: string;
  room: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  rate: number;
  status: BookingStatus;
};

export const bookings: Booking[] = [
  { id: "b1", ref: "BK-24801", guest: "Nabin Karki", room: "104", roomType: "Standard Double", checkIn: "2026-08-02", checkOut: "2026-08-05", nights: 3, guests: 2, rate: 4500, status: "checked-in" },
  { id: "b2", ref: "BK-24802", guest: "Elena Fischer", room: "210", roomType: "Deluxe King", checkIn: "2026-08-02", checkOut: "2026-08-04", nights: 2, guests: 2, rate: 7200, status: "checked-in" },
  { id: "b3", ref: "BK-24803", guest: "Rahul Menon", room: "305", roomType: "Himalaya Suite", checkIn: "2026-08-03", checkOut: "2026-08-08", nights: 5, guests: 4, rate: 14500, status: "reserved" },
  { id: "b4", ref: "BK-24804", guest: "Sita Gurung", room: "112", roomType: "Twin Executive", checkIn: "2026-08-01", checkOut: "2026-08-02", nights: 1, guests: 3, rate: 6400, status: "checked-out" },
  { id: "b5", ref: "BK-24805", guest: "James O'Connor", room: "208", roomType: "Deluxe King", checkIn: "2026-08-04", checkOut: "2026-08-07", nights: 3, guests: 1, rate: 7200, status: "reserved" },
  { id: "b6", ref: "BK-24806", guest: "Mika Tanaka", room: "301", roomType: "Standard Double", checkIn: "2026-08-02", checkOut: "2026-08-06", nights: 4, guests: 2, rate: 4500, status: "checked-in" },
  { id: "b7", ref: "BK-24807", guest: "Priya Sharma", room: "115", roomType: "Twin Executive", checkIn: "2026-08-05", checkOut: "2026-08-09", nights: 4, guests: 2, rate: 6400, status: "reserved" },
  { id: "b8", ref: "BK-24808", guest: "Tom Bakker", room: "203", roomType: "Standard Double", checkIn: "2026-07-30", checkOut: "2026-08-02", nights: 3, guests: 2, rate: 4500, status: "cancelled" },
];

export type Guest = {
  id: string;
  name: string;
  phone: string;
  email: string;
  idType: string;
  nationality: string;
  stays: number;
};

export const guests: Guest[] = [
  { id: "g1", name: "Nabin Karki", phone: "+977 9841 223344", email: "nabin.karki@mail.com", idType: "Citizenship", nationality: "Nepal", stays: 6 },
  { id: "g2", name: "Elena Fischer", phone: "+49 151 2233 445", email: "e.fischer@mail.de", idType: "Passport", nationality: "Germany", stays: 2 },
  { id: "g3", name: "Rahul Menon", phone: "+91 98200 11223", email: "rahul.menon@mail.in", idType: "Passport", nationality: "India", stays: 4 },
  { id: "g4", name: "Sita Gurung", phone: "+977 9802 556677", email: "sita.g@mail.com", idType: "Citizenship", nationality: "Nepal", stays: 9 },
  { id: "g5", name: "James O'Connor", phone: "+353 87 445 2211", email: "j.oconnor@mail.ie", idType: "Passport", nationality: "Ireland", stays: 1 },
  { id: "g6", name: "Mika Tanaka", phone: "+81 90 8877 2211", email: "mika.t@mail.jp", idType: "Passport", nationality: "Japan", stays: 3 },
];

export const guestStays: Record<string, { ref: string; room: string; dates: string; amount: number }[]> = {
  g1: [
    { ref: "BK-24801", room: "104", dates: "02 Aug – 05 Aug 2026", amount: 13500 },
    { ref: "BK-23120", room: "212", dates: "14 Mar – 16 Mar 2026", amount: 14400 },
    { ref: "BK-22087", room: "101", dates: "02 Jan – 04 Jan 2026", amount: 9000 },
  ],
};

export type Invoice = {
  id: string;
  number: string;
  date: string;
  guest: string;
  amount: number;
  vat: number;
  status: "paid" | "unpaid";
};

export const invoices: Invoice[] = [
  { id: "i1", number: "INV-2026-0412", date: "02 Aug 2026", guest: "Sita Gurung", amount: 7232, vat: 832, status: "paid" },
  { id: "i2", number: "INV-2026-0411", date: "01 Aug 2026", guest: "Tom Bakker", amount: 15255, vat: 1755, status: "unpaid" },
  { id: "i3", number: "INV-2026-0410", date: "31 Jul 2026", guest: "Mika Tanaka", amount: 20340, vat: 2340, status: "paid" },
  { id: "i4", number: "INV-2026-0409", date: "30 Jul 2026", guest: "Elena Fischer", amount: 16272, vat: 1872, status: "paid" },
  { id: "i5", number: "INV-2026-0408", date: "29 Jul 2026", guest: "Rahul Menon", amount: 81925, vat: 9425, status: "paid" },
];

export const revenueSeries = [
  { day: "Mon", revenue: 128000, occupancy: 62 },
  { day: "Tue", revenue: 141500, occupancy: 68 },
  { day: "Wed", revenue: 119800, occupancy: 58 },
  { day: "Thu", revenue: 168200, occupancy: 74 },
  { day: "Fri", revenue: 204600, occupancy: 88 },
  { day: "Sat", revenue: 231400, occupancy: 94 },
  { day: "Sun", revenue: 186900, occupancy: 81 },
];

export const staff = [
  { id: "s1", name: "Aarati Shrestha", email: "aarati@himalayagrand.com", role: "Owner", active: true },
  { id: "s2", name: "Bibek Thapa", email: "bibek@himalayagrand.com", role: "Manager", active: true },
  { id: "s3", name: "Sunita Rai", email: "sunita@himalayagrand.com", role: "Front Desk", active: true },
  { id: "s4", name: "Dipesh Adhikari", email: "dipesh@himalayagrand.com", role: "Accountant", active: true },
  { id: "s5", name: "Kritika Basnet", email: "kritika@himalayagrand.com", role: "Front Desk", active: false },
];

export const folioCharges = [
  { id: "c1", date: "02 Aug", description: "Room 104 — Standard Double (night 1)", qty: 1, unit: 4500, vat: 13 },
  { id: "c2", date: "03 Aug", description: "Room 104 — Standard Double (night 2)", qty: 1, unit: 4500, vat: 13 },
  { id: "c3", date: "03 Aug", description: "Breakfast buffet", qty: 2, unit: 850, vat: 13 },
  { id: "c4", date: "03 Aug", description: "Airport pickup", qty: 1, unit: 1800, vat: 13 },
  { id: "c5", date: "04 Aug", description: "Laundry service", qty: 1, unit: 650, vat: 13 },
];
