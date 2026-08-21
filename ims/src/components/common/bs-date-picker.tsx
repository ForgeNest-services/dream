import { useEffect, useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BS_MONTHS, bsDaysInMonth, bsYears } from "@/lib/nepali-date";
import { cn } from "@/lib/utils";

// Native BS date picker/filter. Value + onChange operate on BS ISO strings
// ("YYYY-MM-DD" in BS) only — no Gregorian conversion happens in this
// component. Ported from rms/src/components/pos/BsDatePicker.tsx so IMS's
// date filters (Purchase Bills, Stock Movements) work the same way RMS's
// reports/orders filters do: purely in Bikram Sambat, matching how the
// backend now stores/filters bs_from/bs_to against a *_bs column (see
// api/utils/bikram_sambat.py) — no AD timestamp ever appears in these URLs.

function parseBsIso(bs: string): { year: number; month: number; day: number } | null {
  if (!bs) return null;
  const parts = bs.split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d) return null;
  return { year: y, month: m, day: d };
}

function toBsIso(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function bsIsoToLabel(bs: string): string {
  const parsed = parseBsIso(bs);
  if (!parsed) return "";
  return `${BS_MONTHS[parsed.month - 1]} ${parsed.day}, ${parsed.year} BS`;
}

export function BsDatePicker({
  value,
  onChange,
  placeholder = "Pick a Nepali date",
  allowClear = true,
  className,
}: {
  value: string; // "YYYY-MM-DD" in BS, or "" for unset
  onChange: (bsIso: string) => void;
  placeholder?: string;
  allowClear?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const parsed = parseBsIso(value);
  const years = bsYears();
  const defaultYear = years.includes(2082) ? 2082 : years[years.length - 1];

  const [year, setYear] = useState<number>(parsed?.year ?? defaultYear);
  const [month, setMonth] = useState<number>(parsed?.month ?? 1);

  useEffect(() => {
    if (parsed) {
      setYear(parsed.year);
      setMonth(parsed.month);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const daysInMonth = bsDaysInMonth(year, month);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const label = value ? bsIsoToLabel(value) : placeholder;

  const pick = (day: number) => {
    onChange(toBsIso(year, month, day));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "justify-start gap-2 font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarDays className="h-4 w-4" />
          <span className="num truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-3" align="start">
        <div className="flex gap-2">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y} BS
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {BS_MONTHS.map((m, idx) => (
                <SelectItem key={m} value={String(idx + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1">
          {days.map((d) => {
            const isSelected = parsed?.year === year && parsed?.month === month && parsed?.day === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => pick(d)}
                className={cn(
                  "grid size-9 place-items-center rounded-md text-sm transition-colors",
                  isSelected ? "bg-primary text-primary-foreground" : "hover:bg-secondary",
                )}
              >
                {d}
              </button>
            );
          })}
        </div>

        {allowClear && value && (
          <Button
            type="button"
            variant="ghost"
            className="mt-3 h-8 w-full gap-1.5 text-xs"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            <X className="size-3.5" />
            Clear
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function BsDateRangeFilter({
  from,
  to,
  onFrom,
  onTo,
}: {
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <BsDatePicker value={from} onChange={onFrom} placeholder="From date" className="h-9" />
      <span className="text-muted-foreground">→</span>
      <BsDatePicker value={to} onChange={onTo} placeholder="To date" className="h-9" />
      {(from || to) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onFrom("");
            onTo("");
          }}
        >
          Clear
        </Button>
      )}
    </div>
  );
}
