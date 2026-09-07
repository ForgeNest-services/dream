import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Boxes,
  Building2,
  CalendarRange,
  ChevronDown,
  Download,
  LayoutDashboard,
  LogOut,
  Moon,
  MoreVertical,
  Receipt,
  ShoppingCart,
  Search,
  Settings,
  Sun,
  Users,
  BarChart3,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useApp } from "@/context/app-store";
import { ROLE_LABELS, type ModuleKey, type Role } from "@/data/types";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const MODULES: { key: ModuleKey; label: string; to: string; icon: typeof Boxes }[] = [
  { key: "dashboard", label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { key: "purchase", label: "Purchase", to: "/purchase/new", icon: ShoppingCart },
  { key: "inventory", label: "Inventory", to: "/inventory/products", icon: Boxes },
  { key: "sales", label: "Sales", to: "/sales/pos", icon: Receipt },
  { key: "parties", label: "Parties", to: "/parties/customers", icon: Users },
  { key: "reports", label: "Reports", to: "/reports", icon: BarChart3 },
  { key: "settings", label: "Settings", to: "/settings", icon: Settings },
];

export function TopBar({ onOpenCommand }: { onOpenCommand: () => void }) {
  const app = useApp();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { canInstall, installed, install } = useInstallPrompt();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const visible = MODULES.filter((m) => app.modules.includes(m.key));
  const branchLabel = app.branches.find((b) => b.id === app.branchId)?.name ?? "Branch";

  const handleInstall = async () => {
    if (canInstall) {
      await install();
    } else {
      toast.info("Install from your browser menu", {
        description: "Chrome/Edge: menu → Install app. iOS Safari: Share → Add to Home Screen.",
      });
    }
  };

  return (
    <header className="no-print sticky top-0 z-40 border-b bg-ink text-ink-foreground">
      <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
        <Link to="/dashboard" className="shrink-0" aria-label="SROTA IMS home">
          <img src="/srota-ims-logo.png" alt="SROTA IMS" className="h-12 w-auto rounded-md px-2 py-1" />
        </Link>

        <nav className="hidden min-w-0 items-center gap-0.5 lg:flex">
          {visible.map((m) => {
            const active = pathname.startsWith(`/${m.to.split("/")[1]}`);
            return (
              <Link
                key={m.key}
                to={m.to}
                className={cn(
                  "whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-ink-foreground"
                    : "text-ink-foreground/65 hover:bg-sidebar-accent/60 hover:text-ink-foreground",
                )}
              >
                {m.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={onOpenCommand}
          className="ml-auto flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/50 px-3 text-sm text-ink-foreground/60 transition-colors hover:bg-sidebar-accent sm:max-w-xs xl:max-w-sm"
          aria-label="Search"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="hidden truncate sm:inline">Search…</span>
          <kbd className="ml-auto hidden rounded border border-sidebar-border px-1.5 py-0.5 text-[10px] lg:inline">
            ⌘K
          </kbd>
        </button>

        {/* Branch switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 gap-1.5 px-2 text-ink-foreground hover:bg-sidebar-accent hover:text-ink-foreground"
            >
              <Building2 className="h-4 w-4 shrink-0" />
              <span className="hidden max-w-28 truncate 2xl:inline">{branchLabel}</span>
              <ChevronDown className="hidden h-3.5 w-3.5 opacity-60 sm:inline" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Branch</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={app.branchId} onValueChange={app.setBranchId}>
              {app.branches
                .filter((b) => app.can("branch.all") || app.currentUser?.branchIds.includes(b.id))
                .map((b) => (
                  <DropdownMenuRadioItem key={b.id} value={b.id}>
                    {b.name}
                  </DropdownMenuRadioItem>
                ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Fiscal year */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 gap-1.5 px-2 text-ink-foreground hover:bg-sidebar-accent hover:text-ink-foreground"
              title="Fiscal year"
            >
              <CalendarRange className="h-4 w-4 shrink-0" />
              <span className="num hidden text-xs md:inline">{app.fiscalYear.label}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Fiscal year (BS)</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={app.fiscalYear.id} onValueChange={app.setFiscalYearId}>
              {app.fiscalYears.map((f) => (
                <DropdownMenuRadioItem key={f.id} value={f.id} className="num">
                  {f.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
              Manage fiscal years
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Inline utilities on wide screens */}
        <div className="hidden shrink-0 items-center gap-1 xl:flex">
          <Button
            variant="ghost"
            size="icon"
            className="text-ink-foreground hover:bg-sidebar-accent hover:text-ink-foreground"
            onClick={() => setDark((d) => !d)}
            aria-label="Toggle theme"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {!installed && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-sidebar-border bg-transparent text-ink-foreground hover:bg-sidebar-accent hover:text-ink-foreground"
              onClick={handleInstall}
            >
              <Download className="h-4 w-4" /> Install
            </Button>
          )}
        </div>

        {/* Overflow menu on narrow screens */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-ink-foreground hover:bg-sidebar-accent hover:text-ink-foreground xl:hidden"
              aria-label="More options"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => setDark((d) => !d)}>
              {dark ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
              {dark ? "Light theme" : "Dark theme"}
            </DropdownMenuItem>
            {!installed && (
              <DropdownMenuItem onClick={handleInstall}>
                <Download className="mr-2 h-4 w-4" /> Install app
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 gap-2 px-1.5 text-ink-foreground hover:bg-sidebar-accent hover:text-ink-foreground"
            >
              {app.company.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={app.company.logoUrl}
                  alt=""
                  className="h-6 w-6 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                  {app.currentUser?.name.slice(0, 2).toUpperCase()}
                </span>
              )}
              <span className="hidden min-w-0 text-left leading-tight 2xl:block">
                <span className="block truncate text-xs">{app.currentUser?.name}</span>
                <span className="block text-[10px] opacity-60">
                  {ROLE_LABELS[app.effectiveRole]}
                </span>
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              {app.currentUser?.name}
              <span className="block text-xs font-normal text-muted-foreground">
                @{app.currentUser?.username}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {app.currentUser?.role === "owner" && (
              <>
                <DropdownMenuLabel className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                  <Eye className="h-3.5 w-3.5" /> View app as
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={app.viewAsRole ?? "owner"}
                  onValueChange={(v) => app.setViewAsRole(v === "owner" ? null : (v as Role))}
                >
                  {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                    <DropdownMenuRadioItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              onClick={() => {
                app.logout();
                navigate({ to: "/", replace: true });
              }}
            >
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* mobile module row */}
      <div className="flex gap-1 overflow-x-auto border-t border-sidebar-border px-3 py-1.5 lg:hidden">
        {visible.map((m) => (
          <Link
            key={m.key}
            to={m.to}
            className="whitespace-nowrap rounded-md px-2.5 py-1 text-xs text-ink-foreground/70 hover:bg-sidebar-accent"
          >
            {m.label}
          </Link>
        ))}
      </div>
    </header>
  );
}

export function SubTabs({ items }: { items: { label: string; to: string }[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="no-print border-b bg-card">
      <div className="flex gap-1.5 overflow-x-auto px-4 py-2.5">
        {items.map((i) => {
          const active = pathname === i.to || pathname.startsWith(`${i.to}/`);
          return (
            <Link
              key={i.to}
              to={i.to}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {i.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
