import { useApp } from "@/context/app-store";
import { formatMoney, formatQty } from "@/lib/format";
import { formatAd, formatBs } from "@/lib/nepali-date";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Money({ value, className }: { value: number; className?: string }) {
  const { currency } = useApp();
  return <span className={cn("num", className)}>{formatMoney(value, currency)}</span>;
}

export function Qty({
  value,
  unit,
  decimals,
  className,
}: {
  value: number;
  unit?: string;
  decimals?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("num", className)}>
      {formatQty(value, decimals)}
      {unit ? <span className="ml-1 text-xs text-muted-foreground">{unit}</span> : null}
    </span>
  );
}

export function DateText({
  value,
  withAlt = false,
  long = false,
}: {
  value: string | Date;
  withAlt?: boolean;
  long?: boolean;
}) {
  const { dateSystem } = useApp();
  const date = typeof value === "string" ? new Date(value) : value;
  const primary =
    dateSystem === "BS" ? formatBs(date, long ? "long" : "short") : formatAd(date, long ? "long" : "short");
  const alt = dateSystem === "BS" ? formatAd(date) : formatBs(date);
  return (
    <span className="num whitespace-nowrap">
      {primary}
      {withAlt ? <span className="ml-1.5 text-xs text-muted-foreground">({alt})</span> : null}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-medium tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "success" | "warning" | "destructive" | "info";
  icon?: ReactNode;
}) {
  const toneRing: Record<string, string> = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
    info: "text-info",
  };
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </div>
      <p className={cn("num mt-2 text-2xl font-medium tracking-tight", toneRing[tone])}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card/50 px-6 py-14 text-center">
      <p className="font-medium">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-success/12 text-success",
    partial: "bg-warning/15 text-warning",
    unpaid: "bg-destructive/12 text-destructive",
    cancelled: "bg-muted text-muted-foreground",
    "in-stock": "bg-success/12 text-success",
    low: "bg-warning/15 text-warning",
    out: "bg-destructive/12 text-destructive",
  };
  const label: Record<string, string> = {
    "in-stock": "In stock",
    low: "Low stock",
    out: "Out of stock",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        map[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {label[status] ?? status}
    </span>
  );
}
