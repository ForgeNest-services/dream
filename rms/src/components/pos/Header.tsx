import { Building2, ChevronDown, Eye, LogOut } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_LABELS, type Role } from "@/lib/pos/data";
import { usePos } from "@/lib/pos/store";
import { formatBikramSambat, formatGregorian } from "@/lib/pos/nepali-date";

const ROLES: Role[] = ["owner", "manager", "waiter", "chef"];

export function PosHeader() {
  const {
    session,
    logout,
    actualRole,
    viewAsRole,
    effectiveRole,
    setViewAsRole,
    branch,
    branchId,
    branches,
    canSwitchBranch,
    setBranchId,
    tenant,
  } = usePos();
  if (!session) return null;
  const today = new Date();
  const isPreviewing = actualRole === "owner" && viewAsRole !== null && viewAsRole !== "owner";

  return (
    <>
      {isPreviewing && (
        <div className="flex items-center justify-between gap-3 bg-amber px-4 py-2 text-sm font-medium text-navy">
          <span className="flex items-center gap-2">
            <Eye className="size-4" />
            Previewing as {ROLE_LABELS[viewAsRole!]} — you still have Owner permissions.
          </span>
          <button
            onClick={() => setViewAsRole(null)}
            className="rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide hover:bg-navy/10"
          >
            Exit preview
          </button>
        </div>
      )}
      <header className="sticky top-0 z-40 border-b border-navy-soft/40 bg-navy text-navy-foreground">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src="/logo.png"
            alt="Srota RMS"
            className="h-10 w-auto shrink-0 sm:h-11"
          />
          {/* Branch chip on tablet+ only. For Owners with multiple branches
              this is a switcher; for everyone else (or single-branch tenants)
              it's a read-only label. On mobile the switcher lives on the
              Settings page — matches the "hide in mobile" convention. */}
          {canSwitchBranch && branches.length > 1 ? (
            <div className="hidden min-w-0 sm:block">
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger
                  aria-label="Switch branch"
                  className="h-9 min-w-[9rem] max-w-[16rem] justify-start gap-2 rounded-lg border-navy-soft/60 bg-navy-soft/40 px-2.5 text-left text-sm font-medium text-navy-foreground hover:bg-navy-soft/70"
                >
                  <Building2 className="size-[18px] shrink-0 opacity-70" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  {branches.map((b) => (
                    <SelectItem
                      key={b.id}
                      value={b.id}
                      className="justify-start py-2.5 text-left"
                    >
                      <div className="flex min-w-0 flex-col items-start justify-start">
                        <p className="truncate font-semibold">{b.name}</p>
                        {b.address && (
                          <p className="truncate text-xs text-muted-foreground">
                            {b.address}
                          </p>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            branch && (
              <p className="hidden truncate text-sm font-medium text-navy-foreground/80 sm:block">
                {branch.name}
              </p>
            )
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
                className="h-11 gap-2 rounded-xl bg-navy-soft/60 px-3 text-navy-foreground hover:bg-navy-soft hover:text-navy-foreground"
              >
                {tenant?.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tenant.logo_url}
                    alt=""
                    className="size-7 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                    {(session.name || session.username).slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="hidden text-left sm:block">
                  <span className="block text-sm font-semibold leading-none">{session.name || session.username}</span>
                  <span className="block text-[11px] uppercase tracking-wider text-amber">
                    {ROLE_LABELS[effectiveRole ?? actualRole ?? "waiter"]}
                  </span>
                </span>
                <ChevronDown className="size-4 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {actualRole === "owner" ? (
                <>
                  <DropdownMenuLabel>Preview as role</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {ROLES.map((r) => (
                    <DropdownMenuItem
                      key={r}
                      className="py-3 font-semibold"
                      onClick={() => setViewAsRole(r === "owner" ? null : r)}
                    >
                      {ROLE_LABELS[r]}
                      {(viewAsRole ?? "owner") === r && (
                        <span className="ml-auto text-xs text-primary">active</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              ) : (
                <>
                  <DropdownMenuLabel>{ROLE_LABELS[actualRole ?? "waiter"]}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                </>
              )}
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
    </>
  );
}
