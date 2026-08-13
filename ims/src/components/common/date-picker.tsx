import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { useApp } from "@/context/app-store";
import {
  BS_MONTHS,
  adToBs,
  bsDaysInMonth,
  bsToAd,
  bsYears,
  formatAd,
  formatBs,
} from "@/lib/nepali-date";
import { cn } from "@/lib/utils";
import { CalendarDays } from "lucide-react";
import { useState } from "react";

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick date",
  className,
}: {
  value: string | null;
  onChange: (iso: string | null) => void;
  placeholder?: string;
  className?: string;
}) {
  const { dateSystem } = useApp();
  const [open, setOpen] = useState(false);
  const date = value ? new Date(value) : null;
  const bs = date ? adToBs(date) : adToBs(new Date());

  const label = date
    ? dateSystem === "BS"
      ? `${formatBs(date, "long")} BS`
      : formatAd(date, "long")
    : placeholder;

  const setBsPart = (part: "year" | "month" | "day", raw: string) => {
    const next = { ...bs, [part]: Number(raw) };
    next.day = Math.min(next.day, bsDaysInMonth(next.year, next.month));
    onChange(bsToAd(next).toISOString());
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start gap-2 font-normal",
            !date && "text-muted-foreground",
            className,
          )}
        >
          <CalendarDays className="h-4 w-4" />
          <span className="num truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {dateSystem === "BS" ? (
          <div className="pointer-events-auto space-y-3 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Bikram Sambat
            </p>
            <div className="flex gap-2">
              <Select value={String(bs.year)} onValueChange={(v) => setBsPart("year", v)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bsYears().map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(bs.month)} onValueChange={(v) => setBsPart("month", v)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BS_MONTHS.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(bs.day)} onValueChange={(v) => setBsPart("day", v)}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: bsDaysInMonth(bs.year, bs.month) }, (_, i) => i + 1).map(
                    (d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              AD equivalent: {date ? formatAd(date, "long") : "—"}
            </p>
            <div className="flex justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange(new Date().toISOString());
                }}
              >
                Today
              </Button>
              <Button size="sm" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <Calendar
            mode="single"
            selected={date ?? undefined}
            onSelect={(d) => {
              onChange(d ? d.toISOString() : null);
              setOpen(false);
            }}
            initialFocus
            className={cn("pointer-events-auto p-3")}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

export function DateRangeFilter({
  from,
  to,
  onFrom,
  onTo,
}: {
  from: string | null;
  to: string | null;
  onFrom: (v: string | null) => void;
  onTo: (v: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DatePicker value={from} onChange={onFrom} placeholder="From date" className="h-9" />
      <span className="text-muted-foreground">→</span>
      <DatePicker value={to} onChange={onTo} placeholder="To date" className="h-9" />
      {(from || to) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onFrom(null);
            onTo(null);
          }}
        >
          Clear
        </Button>
      )}
    </div>
  );
}
