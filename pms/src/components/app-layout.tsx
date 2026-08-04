import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CalendarDays,
  BedDouble,
  Users,
  ReceiptText,
  FileBarChart,
  UserCog,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Hotel,
  Building2,
  Sparkles,
  Eye,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { useApp, PRODUCT_NAME, type Currency } from "@/lib/app-state";
import { ALL_ROLES, ROLE_LABELS, type RoleCode } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Operations" },
  { to: "/bookings", label: "Bookings", icon: CalendarDays, group: "Operations" },
  { to: "/rooms", label: "Rooms", icon: BedDouble, group: "Operations" },
  { to: "/housekeeping", label: "Housekeeping", icon: Sparkles, group: "Operations" },
  { to: "/guests", label: "Guests", icon: Users, group: "Operations" },
  { to: "/folio", label: "Folio / Billing", icon: ReceiptText, group: "Finance" },
  { to: "/invoices", label: "Invoices & Reports", icon: FileBarChart, group: "Finance" },
  { to: "/payments", label: "Payments", icon: ReceiptText, group: "Finance" },
  { to: "/staff", label: "Staff / Users", icon: UserCog, group: "Administration" },
  { to: "/settings", label: "Settings", icon: Settings, group: "Administration" },
] as const;

// Menu visibility per role. Backend still authorizes every action; this only
// filters what appears in the sidebar.
const ALLOWED: Record<RoleCode, string[]> = {
  app_owner: NAV.map((n) => n.to),
  manager: NAV.map((n) => n.to).filter(
    (t) => t !== "/settings" && t !== "/staff" && t !== "/payments",
  ),
  front_desk: ["/dashboard", "/bookings", "/guests", "/folio", "/housekeeping"],
};

export function allowedFor(role: RoleCode): string[] {
  return ALLOWED[role];
}

export function AppLayout({ children }: { children: ReactNode }) {
  const {
    actualRole,
    viewAsRole,
    effectiveRole,
    setViewAsRole,
    currency,
    setCurrency,
    username,
    logout,
    properties,
    propertyId,
    setPropertyId,
    property,
  } = useApp();

  const [collapsed, setCollapsed] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const roleForMenu: RoleCode = effectiveRole ?? "front_desk";
  const items = NAV.filter((n) => ALLOWED[roleForMenu].includes(n.to));
  const groups = Array.from(new Set(items.map((i) => i.group)));

  const isPreviewingOtherRole =
    actualRole === "app_owner" && viewAsRole !== null && viewAsRole !== "app_owner";

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
          collapsed ? "w-[76px]" : "w-64",
        )}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
            <Hotel className="size-5" />
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate font-display text-lg font-semibold leading-none">
                {PRODUCT_NAME}
              </span>
              <span className="block truncate text-[11px] uppercase tracking-[0.16em] text-sidebar-foreground/50">
                Hotel platform
              </span>
            </span>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          {groups.map((group) => (
            <div key={group} className="mb-6">
              {!collapsed && (
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/45">
                  {group}
                </p>
              )}
              <ul className="space-y-1">
                {items
                  .filter((i) => i.group === group)
                  .map((item) => {
                    const active = pathname === item.to;
                    return (
                      <li key={item.to}>
                        <Link
                          to={item.to}
                          title={item.label}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                            active
                              ? "bg-sidebar-primary text-sidebar-primary-foreground"
                              : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          )}
                        >
                          <item.icon className="size-[18px] shrink-0" />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-[18px]" />
            ) : (
              <>
                <PanelLeftClose className="size-[18px]" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {isPreviewingOtherRole && (
          <div className="flex items-center justify-between gap-3 bg-accent px-4 py-2 text-sm text-accent-foreground lg:px-8">
            <span className="flex items-center gap-2">
              <Eye className="size-4" />
              Previewing as{" "}
              <span className="font-semibold">{ROLE_LABELS[viewAsRole!]}</span> — you still have Owner permissions.
            </span>
            <button
              onClick={() => setViewAsRole(null)}
              className="rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide hover:bg-accent-foreground/10"
            >
              Exit preview
            </button>
          </div>
        )}

        <header className="sticky top-0 z-30 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-card/90 px-4 py-3 backdrop-blur md:h-16 md:py-0 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground md:hidden">
              <Hotel className="size-5" />
            </span>
            <Select value={propertyId} onValueChange={setPropertyId}>
              <SelectTrigger
                className="h-11 min-w-0 max-w-[280px] gap-2 border-border bg-secondary/60 px-3"
                aria-label="Switch property"
              >
                <Building2 className="size-4 shrink-0 text-accent" />
                <span className="min-w-0 text-left">
                  <span className="block truncate font-display text-[15px] font-semibold leading-tight">
                    {property.name}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {property.location}
                  </span>
                </span>
              </SelectTrigger>
              <SelectContent>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {p.location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {actualRole === "app_owner" && (
              <Select
                value={viewAsRole ?? "app_owner"}
                onValueChange={(v) =>
                  setViewAsRole(v === "app_owner" ? null : (v as RoleCode))
                }
              >
                <SelectTrigger
                  className="hidden h-9 w-[160px] gap-2 lg:flex"
                  aria-label="Preview as role"
                >
                  <Eye className="size-4 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r === "app_owner" ? "Owner view" : `View as ${ROLE_LABELS[r]}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
              <SelectTrigger className="h-9 w-[86px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["NPR", "USD", "EUR", "INR"].map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="hidden items-center gap-2 border-l border-border pl-3 sm:flex">
              <div className="text-right">
                <p className="text-sm font-semibold leading-tight">{username ?? "—"}</p>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">
                  {actualRole ? ROLE_LABELS[actualRole] : ""}
                </span>
              </div>
              <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {(username ?? "?").slice(0, 1).toUpperCase()}
              </span>
            </div>

            <Button variant="ghost" size="icon" onClick={logout} aria-label="Log out">
              <LogOut className="size-[18px]" />
            </Button>
          </div>
        </header>

        <div className="flex gap-1 overflow-x-auto border-b border-border bg-card px-3 py-2 md:hidden">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold",
                pathname === item.to
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-10">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-8 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-3xl leading-none sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
