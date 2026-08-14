import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu as MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { MANAGER_NAV } from "@/lib/pos/nav";

// Two nav shapes:
//   Desktop (lg+): the original horizontal scrolling tab bar. Fine for wide
//                   screens where all 12+ items fit and the pointer is precise.
//   Mobile/tablet: a hamburger that opens a Sheet drawer with big-tap-target
//                   nav items. Waiters use this app one-handed on phones —
//                   horizontal scrolling with 40px pills is thumb-hostile.
export function PosNav() {
  return (
    <>
      <div className="hidden lg:block">
        <DesktopNav />
      </div>
      <div className="lg:hidden">
        <MobileNavTrigger />
      </div>
    </>
  );
}

function DesktopNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="sticky top-[68px] z-30 flex items-center gap-2 overflow-x-auto border-b border-border bg-card p-2">
      {MANAGER_NAV.map((n) => {
        const active = pathname === n.to || pathname.startsWith(`${n.to}/`);
        return (
          <Link
            key={n.key}
            to={n.to}
            className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-foreground hover:bg-secondary/70"
            }`}
          >
            <n.icon className="size-4" />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

function MobileNavTrigger() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeItem = MANAGER_NAV.find(
    (n) => pathname === n.to || pathname.startsWith(`${n.to}/`),
  );
  return (
    <div className="sticky top-[60px] z-30 flex items-center justify-between border-b border-border bg-card p-2">
      <div className="flex min-w-0 items-center gap-2 px-2">
        {activeItem && (
          <>
            <activeItem.icon className="size-4 shrink-0 text-primary" />
            <span className="truncate text-sm font-medium">{activeItem.label}</span>
          </>
        )}
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="h-10 gap-1.5">
            <MenuIcon className="size-4" />
            Menu
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-72 p-0">
          <SheetHeader className="border-b border-border p-4">
            <SheetTitle className="font-display text-lg">Navigate</SheetTitle>
          </SheetHeader>
          <nav className="p-2">
            <ul className="space-y-1">
              {MANAGER_NAV.map((n) => {
                const active =
                  pathname === n.to || pathname.startsWith(`${n.to}/`);
                return (
                  <li key={n.key}>
                    <Link
                      to={n.to}
                      onClick={() => setOpen(false)}
                      className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-secondary"
                      }`}
                    >
                      <n.icon className="size-5" />
                      {n.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
