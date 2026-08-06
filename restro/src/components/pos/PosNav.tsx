import { Link, useRouterState } from "@tanstack/react-router";
import { MANAGER_NAV } from "@/lib/pos/nav";

export function PosNav() {
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
