import { useState, useEffect } from "react";
import { BsDatePicker } from "@/components/common/bs-date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adToBs, bsToAd } from "@/lib/nepali-date";
import { cn } from "@/lib/utils";

function adIsoToBsIso(adIso: string): string {
  const [y, m, d] = adIso.split("-").map(Number);
  if (!y || !m || !d) return "";
  const bs = adToBs(new Date(Date.UTC(y, m - 1, d)));
  return `${String(bs.year).padStart(4, "0")}-${String(bs.month).padStart(2, "0")}-${String(bs.day).padStart(2, "0")}`;
}

function bsIsoToAdIso(bsIso: string): string {
  const [y, m, d] = bsIso.split("-").map(Number);
  if (!y || !m || !d) return "";
  const ad = bsToAd({ year: y, month: m, day: d });
  return ad.toISOString().slice(0, 10);
}

function daysFromToday(adIso: string): number | "" {
  if (!adIso) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${adIso}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function adIsoFromDays(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Expiry date entry with two modes: pick a Nepali (BS) calendar date, or
 *  type "expires in N days" and let it resolve to the actual date. Either
 *  way the value/onChange contract is a plain AD "YYYY-MM-DD" string (or ""
 *  for unset) — matching what the backend stores — so callers never need to
 *  know which mode was used. */
export function ExpiryInput({
  value,
  onChange,
  label = "Expiry date (optional)",
  className,
}: {
  value: string;
  onChange: (adIso: string) => void;
  label?: string;
  className?: string;
}) {
  const [mode, setMode] = useState<"date" | "days">("date");

  const [daysText, setDaysText] = useState(() => {
    const d = daysFromToday(value);
    return typeof d === "number" ? String(d) : "";
  });

  // Sync from external value changes (e.g. when user switches modes or parent resets)
  useEffect(() => {
    const d = daysFromToday(value);
    const n = typeof d === "number" ? d : null;
    const roundedText = daysText === "" ? null : Number(daysText);
    if (n !== roundedText) {
      setDaysText(n !== null ? String(n) : "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <div className="flex rounded-md border p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode("date")}
            className={cn(
              "rounded px-2 py-0.5 transition-colors",
              mode === "date" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            Pick date
          </button>
          <button
            type="button"
            onClick={() => setMode("days")}
            className={cn(
              "rounded px-2 py-0.5 transition-colors",
              mode === "days" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            Days from now
          </button>
        </div>
      </div>

      {mode === "date" ? (
        <BsDatePicker
          value={value ? adIsoToBsIso(value) : ""}
          onChange={(bsIso) => onChange(bsIso ? bsIsoToAdIso(bsIso) : "")}
          placeholder="Pick expiry date (BS)"
        />
      ) : (
        <div className="flex items-center gap-2">
          <Input
            type="text"
            inputMode="numeric"
            min={0}
            placeholder="e.g. 90"
            value={daysText}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9]/g, "");
              setDaysText(raw);
              const n = raw === "" ? null : Number(raw);
              onChange(n === null || Number.isNaN(n) ? "" : adIsoFromDays(n));
            }}
            className="num max-w-28"
          />
          <span className="text-xs text-muted-foreground">
            days{value ? ` — expires ${value}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}
