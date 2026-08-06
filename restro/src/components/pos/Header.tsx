import { Building2, ChevronDown, LogOut, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InstallAppButton } from "./InstallAppButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BRANCHES, ROLE_LABELS, type Role } from "@/lib/pos/data";
import { usePos } from "@/lib/pos/store";
import { formatBikramSambat, formatGregorian } from "@/lib/pos/nepali-date";

const ROLES: Role[] = ["owner", "manager", "waiter", "chef"];

export function PosHeader() {
  const { session, logout, setRole, branch, setBranchId, settings } = usePos();
  if (!session) return null;
  const today = new Date();

  return (
    <header className="sticky top-0 z-40 border-b border-navy-soft/40 bg-navy text-navy-foreground">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <UtensilsCrossed className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-lg leading-none">{settings.restaurantName}</p>
            <p className="mt-1 truncate text-xs text-navy-foreground/60">{branch.name}</p>
          </div>

          {session.role === "owner" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="ml-2 hidden h-11 gap-2 rounded-xl bg-navy-soft/60 px-3 text-navy-foreground hover:bg-navy-soft md:inline-flex"
                >
                  <Building2 className="size-4" />
                  <span className="max-w-[10rem] truncate text-sm font-semibold">{branch.name}</span>
                  <ChevronDown className="size-4 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-60">
                <DropdownMenuLabel>Switch branch</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {BRANCHES.map((b) => (
                  <DropdownMenuItem key={b.id} className="py-3" onClick={() => setBranchId(b.id)}>
                    <div>
                      <p className="font-semibold">{b.name}</p>
                      <p className="text-xs text-muted-foreground">{b.address}</p>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <InstallAppButton />
          <div className="hidden text-right leading-tight lg:block">
            <p className="text-sm font-medium text-amber">{formatBikramSambat(today)}</p>
            <p className="text-xs text-navy-foreground/55">{formatGregorian(today)}</p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-11 gap-2 rounded-xl bg-navy-soft/60 px-3 text-navy-foreground hover:bg-navy-soft"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  {session.username.slice(0, 2).toUpperCase()}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block text-sm font-semibold leading-none">{session.username}</span>
                  <span className="block text-[11px] uppercase tracking-wider text-amber">
                    {ROLE_LABELS[session.role]}
                  </span>
                </span>
                <ChevronDown className="size-4 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Demo role switcher</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ROLES.map((r) => (
                <DropdownMenuItem
                  key={r}
                  className="py-3 font-semibold"
                  onClick={() => setRole(r)}
                >
                  {ROLE_LABELS[r]}
                  {session.role === r && <span className="ml-auto text-xs text-primary">active</span>}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <div className="px-2 py-2 lg:hidden">
                <p className="text-xs font-medium text-foreground">{formatBikramSambat(today)}</p>
                <p className="text-xs text-muted-foreground">{formatGregorian(today)}</p>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Log out"
            onClick={logout}
            className="size-11 rounded-xl bg-navy-soft/60 text-navy-foreground hover:bg-danger hover:text-danger-foreground"
          >
            <LogOut className="size-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
