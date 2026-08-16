import {
  BarChart3,
  Bike,
  Boxes,
  CalendarRange,
  ChefHat,
  ClipboardList,
  Contact2,
  LayoutDashboard,
  Notebook,
  Receipt,
  Settings as SettingsIcon,
  UtensilsCrossed,
  Users,
} from "lucide-react";
import type { Role } from "./data";

export type NavItem = {
  key: string;
  label: string;
  to: string;
  icon: React.ElementType;
};

// Order here is the display order of tabs in the header nav.
export const MANAGER_NAV: NavItem[] = [
  { key: "dashboard", label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { key: "orders", label: "Orders", to: "/orders", icon: ClipboardList },
  { key: "menu", label: "Menu", to: "/menu", icon: UtensilsCrossed },
  { key: "delivery", label: "Delivery", to: "/delivery", icon: Bike },
  { key: "kitchen", label: "Kitchen", to: "/kitchen", icon: ChefHat },
  { key: "inventory", label: "Inventory", to: "/inventory", icon: Boxes },
  { key: "expenses", label: "Expenses", to: "/expenses", icon: Receipt },
  { key: "customers", label: "Customers", to: "/customers", icon: Contact2 },
  { key: "khata", label: "Khata", to: "/khata", icon: Notebook },
  { key: "employees", label: "Employees", to: "/employees", icon: Users },
  { key: "daily", label: "Daily Sales", to: "/daily", icon: CalendarRange },
  { key: "reports", label: "Reports", to: "/reports", icon: BarChart3 },
  { key: "settings", label: "Settings", to: "/settings", icon: SettingsIcon },
];

// Where each role lands right after login (and where index redirects to).
export function landingRouteForRole(role: Role): string {
  switch (role) {
    case "chef":
      return "/kitchen";
    case "waiter":
      return "/orders";
    case "owner":
    case "manager":
    default:
      return "/dashboard";
  }
}

// Roles that see the full nav bar. Chef/waiter get a single locked view.
export function roleShowsNav(role: Role): boolean {
  return role === "owner" || role === "manager";
}
