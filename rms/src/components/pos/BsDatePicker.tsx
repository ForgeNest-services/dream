import { useEffect, useMemo, useState } from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BS_CALENDAR, NEPALI_MONTHS, bsIsoToPretty } from "@/lib/pos/nepali-date";

// Native BS date picker. Value + onChange operate on BS ISO strings
// ("YYYY-MM-DD" in BS) — no Gregorian conversion happens here, which is what
// makes it a "real" Nepali calendar for the user.
//
// Deliberately built with the existing shadcn Popover + Select rather than a
// heavier date-picker library — Nepali business software renders BS dates as
// three ordered choices (year → month → day), not a Gregorian-style grid,
// and this maps 1:1 to that model.

interface Props {
  value: string; // "YYYY-MM-DD" in BS, or "" for unset
  onChange: (bsIso: string) => void;
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
}

const BS_YEARS = Object.keys(BS_CALENDAR)
  .map(Number)
  .sort((a, b) => a - b);

function parseBsIso(bs: string): { year: number; month: number; day: number } | null {
  if (!bs) return null;
  const parts = bs.split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d) return null;
  return { year: y, month: m, day: d };
}

function toBsIso(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

export function BsDatePicker({
  value,
  onChange,
  placeholder = "Pick a Nepali date",
  allowClear = true,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const parsed = parseBsIso(value);
  // Track working year/month state inside the popover so users can navigate
  // months without having to pick a valid day at every step. We seed from
  // the current value if set, otherwise from a sensible default (today-ish).
  const today = useMemo(() => {
    // Not converting from Gregorian — just default to something in the
    // middle of the calendar range so the popover isn't blank on first open.
    // Better default: current BS year (approximated as year we know is close).
    const currentYear = BS_YEARS.includes(2082) ? 2082 : BS_YEARS[BS_YEARS.length - 1];
    return { year: currentYear, month: 1 };
  }, []);
  const [year, setYear] = useState<number>(parsed?.year ?? today.year);
  const [month, setMonth] = useState<number>(parsed?.month ?? today.month);

  // Keep the popover's working year/month in sync if the external value
  // changes (e.g. cleared by parent, or a bookmarked URL loaded).
  useEffect(() => {
    if (parsed) {
      setYear(parsed.year);
      setMonth(parsed.month);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const daysInMonth = BS_CALENDAR[year]?.[month - 1] ?? 30;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const label = value ? bsIsoToPretty(value) : placeholder;

  const pick = (day: number) => {
    onChange(toBsIso(year, month, day));
    setOpen(false);
  };

  const clear = () => {
    onChange("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="h-11 w-full justify-between gap-2 font-normal"
        >
          <span className={`truncate ${value ? "text-foreground" : "text-muted-foreground"}`}>
            {label}
          </span>
          <CalendarIcon className="size-4 shrink-0 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-3" align="start">
        <div className="flex gap-2">
          <Select
            value={String(year)}
            onValueChange={(v) => setYear(Number(v))}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {BS_YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y} BS
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(month)}
            onValueChange={(v) => setMonth(Number(v))}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {NEPALI_MONTHS.map((m, idx) => (
                <SelectItem key={m} value={String(idx + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1">
          {days.map((d) => {
            const isSelected =
              parsed?.year === year && parsed?.month === month && parsed?.day === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => pick(d)}
                className={`grid size-9 place-items-center rounded-md text-sm transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-secondary"
                }`}
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
            onClick={clear}
          >
            <X className="size-3.5" />
            Clear
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
