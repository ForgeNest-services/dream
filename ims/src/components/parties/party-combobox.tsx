import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { partiesApi } from "@/lib/parties-api";
import { cn } from "@/lib/utils";
import type { Party } from "@/data/types";

const num = (v: number | string | null | undefined): number => (v == null ? 0 : Number(v));

function dtoToParty(p: {
  id: string;
  name: string;
  kind: "supplier" | "customer";
  phone: string | null;
  email: string | null;
  address: string | null;
  pan: string | null;
  is_vat_registered: boolean | null;
  credit_limit: number | string | null;
  opening_balance: number | string;
  terms: string | null;
}): Party {
  return {
    id: p.id,
    name: p.name,
    kind: p.kind,
    phone: p.phone ?? "",
    email: p.email ?? undefined,
    address: p.address ?? "",
    pan: p.pan ?? undefined,
    isVatRegistered: p.is_vat_registered ?? undefined,
    creditLimit: p.credit_limit == null ? undefined : num(p.credit_limit),
    openingBalance: num(p.opening_balance),
    terms: p.terms ?? undefined,
  };
}

// Searchable party picker — queries the backend (name/phone/PAN) as you
// type, debounced, instead of filtering an already-loaded page. `selected`
// lets the caller hand over the currently-chosen party directly (e.g. just
// created via the inline "+" dialog) so its label renders even before any
// search has run.
export function PartyCombobox({
  kind,
  value,
  selected: selectedProp,
  onChange,
  onSelectParty,
  placeholder = "Search by name, phone or PAN…",
  noneLabel,
  noneValue = "",
}: {
  kind: "supplier" | "customer";
  value: string;
  /** The full Party for `value`, if the caller already has it (avoids an
   * extra lookup and keeps the label correct before any search runs). */
  selected?: Party | undefined;
  onChange: (id: string) => void;
  /** Fired with the full Party object alongside onChange, when available. */
  onSelectParty?: ((party: Party) => void) | undefined;
  placeholder?: string;
  noneLabel?: string;
  noneValue?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);
  const [results, setResults] = useState<Party[]>([]);
  const [loading, setLoading] = useState(false);
  const isNone = value === noneValue;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    partiesApi
      .list(kind, { q: debouncedQ || undefined, per_page: 20 })
      .then((res) => {
        if (cancelled) return;
        setResults((res.data ?? []).map(dtoToParty));
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, kind, debouncedQ]);

  // Make sure the currently-selected party always appears (e.g. picked
  // before this exact search text, or handed in via `selected`) so it isn't
  // silently dropped from the list while its label is shown on the trigger.
  const list =
    selectedProp && !results.some((p) => p.id === selectedProp.id)
      ? [selectedProp, ...results]
      : results;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQ("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">
            {selectedProp ? selectedProp.name : noneLabel && isNone ? noneLabel : "Select party…"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={placeholder} value={q} onValueChange={setQ} />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
              </div>
            ) : (
              <CommandEmpty>No match found.</CommandEmpty>
            )}
            <CommandGroup>
              {noneLabel && (
                <CommandItem
                  value="__none__"
                  onSelect={() => {
                    onChange(noneValue);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", isNone ? "opacity-100" : "opacity-0")} />
                  {noneLabel}
                </CommandItem>
              )}
              {list.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.id}
                  onSelect={() => {
                    onChange(p.id);
                    onSelectParty?.(p);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", value === p.id ? "opacity-100" : "opacity-0")}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{p.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[p.phone, p.email, p.pan ? `PAN ${p.pan}` : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
