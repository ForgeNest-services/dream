import { BsDatePicker } from "@/components/common/bs-date-picker";
import { useApp } from "@/context/app-store";
import { formatBs } from "@/lib/nepali-date";
import { cn } from "@/lib/utils";
import { useState } from "react";

type Preset = "today" | "week" | "month" | "fy" | "custom";

function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0 = Sunday
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  return start;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Preset quick-ranges (Today / This week / This month / This fiscal year)
 *  plus a custom BS from/to pair, matching BsDateRangeFilter's picker used
 *  elsewhere — resolves everything to BS "YYYY-MM-DD" strings since that's
 *  what every backend date filter in this app already expects. */
export function DashboardDateFilter({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const app = useApp();
  const [preset, setPreset] = useState<Preset>("month");
  const [showCustom, setShowCustom] = useState(false);

  const today = new Date();
  const todayBs = formatBs(today);

  const apply = (p: Preset) => {
    setPreset(p);
    setShowCustom(false);
    if (p === "today") {
      onChange(todayBs, todayBs);
    } else if (p === "week") {
      onChange(formatBs(startOfWeek(today)), todayBs);
    } else if (p === "month") {
      onChange(formatBs(startOfMonth(today)), todayBs);
    } else if (p === "fy") {
      onChange(`${app.fiscalYear.startYear}-04-01`, todayBs);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="flex rounded-md border bg-muted/40 p-0.5">
        {(
          [
            ["today", "Today"],
            ["week", "This week"],
            ["month", "This month"],
            ["fy", "This FY"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => apply(key)}
            className={cn(
              "rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
              preset === key && !showCustom
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setPreset("custom");
            setShowCustom((s) => !s);
          }}
          className={cn(
            "rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
            preset === "custom" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Custom
        </button>
      </div>
      {showCustom && (
        <div className="flex items-center gap-1.5">
          <BsDatePicker value={from} onChange={(v) => onChange(v, to)} placeholder="From" className="h-9" />
          <span className="text-xs text-muted-foreground">to</span>
          <BsDatePicker value={to} onChange={(v) => onChange(from, v)} placeholder="To" className="h-9" />
        </div>
      )}
    </div>
  );
}
