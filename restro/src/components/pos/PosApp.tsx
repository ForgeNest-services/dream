import { useState } from "react";
import {
  BarChart3,
  Bike,
  Boxes,
  CalendarRange,
  ChefHat,
  ClipboardList,
  LayoutDashboard,
  Receipt,
  Settings as SettingsIcon,
  UtensilsCrossed,
  Users,
} from "lucide-react";
import { PosHeader } from "./Header";
import { LoginScreen } from "./Login";
import { DashboardView } from "./DashboardView";
import { MenuView } from "./MenuView";
import { InventoryView } from "./InventoryView";
import { EmployeesView } from "./EmployeesView";
import { ReportsView } from "./ReportsView";
import { DailySalesView } from "./DailySalesView";
import { ExpensesView } from "./ExpensesView";
import { DeliveryView } from "./DeliveryView";
import { SettingsView } from "./SettingsView";
import { KitchenView } from "./KitchenView";
import { OrdersView } from "./OrdersView";
import { usePos } from "@/lib/pos/store";

type NavKey =
  | "dashboard"
  | "orders"
  | "menu"
  | "delivery"
  | "kitchen"
  | "inventory"
  | "expenses"
  | "employees"
  | "daily"
  | "reports"
  | "settings";

const NAV: { key: NavKey; label: string; icon: React.ElementType }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "orders", label: "Orders", icon: ClipboardList },
  { key: "menu", label: "Menu", icon: UtensilsCrossed },
  { key: "delivery", label: "Delivery", icon: Bike },
  { key: "kitchen", label: "Kitchen", icon: ChefHat },
  { key: "inventory", label: "Inventory", icon: Boxes },
  { key: "expenses", label: "Expenses", icon: Receipt },
  { key: "employees", label: "Employees", icon: Users },
  { key: "daily", label: "Daily Sales", icon: CalendarRange },
  { key: "reports", label: "Reports", icon: BarChart3 },
  { key: "settings", label: "Settings", icon: SettingsIcon },
];

export function PosApp() {
  const { session } = usePos();
  if (!session) return <LoginScreen />;

  return (
    <div className="min-h-screen bg-background">
      <PosHeader />
      {session.role === "chef" ? (
        <main className="p-3 sm:p-5">
          <KitchenView />
        </main>
      ) : session.role === "waiter" ? (
        <main className="p-3 sm:p-5">
          <OrdersView />
        </main>
      ) : (
        <ManagerWorkspace />
      )}
    </div>
  );
}

function ManagerWorkspace() {
  const [nav, setNav] = useState<NavKey>("dashboard");

  return (
    <div className="min-w-0">
      <nav className="sticky top-[68px] z-30 flex items-center gap-2 overflow-x-auto border-b border-border bg-card p-2">
        {NAV.map((n) => (
          <button
            key={n.key}
            onClick={() => setNav(n.key)}
            className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm transition-colors ${
              nav === n.key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-foreground hover:bg-secondary/70"
            }`}
          >
            <n.icon className="size-4" />
            {n.label}
          </button>
        ))}
      </nav>

      <main className="p-3 sm:p-5">
        {nav === "dashboard" && <DashboardView />}
        {nav === "orders" && <OrdersView showControls />}
        {nav === "menu" && <MenuView />}
        {nav === "delivery" && <DeliveryView />}
        {nav === "kitchen" && <KitchenView />}
        {nav === "inventory" && <InventoryView />}
        {nav === "expenses" && <ExpensesView />}
        {nav === "employees" && <EmployeesView />}
        {nav === "daily" && <DailySalesView />}
        {nav === "reports" && <ReportsView />}
        {nav === "settings" && <SettingsView />}
      </main>
    </div>
  );
}
