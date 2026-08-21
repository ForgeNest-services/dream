import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { Party } from "@/data/types";

// Searchable party picker — filters by name, phone, and email as you type.
// cmdk's built-in filter only matches CommandItem's own text content, so we
// bake phone/email into a hidden search-key alongside the visible name
// rather than reimplementing filtering ourselves.
export function PartyCombobox({
  parties,
  value,
  onChange,
  placeholder = "Search by name, phone or email…",
  noneLabel,
  noneValue = "",
}: {
  parties: Party[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  /** When set, renders as the first selectable option (e.g. "No party (stock only)"). */
  noneLabel?: string;
  /** The value onChange fires when the "none" option is picked — callers
   * that use a sentinel like "none" instead of "" pass it here. */
  noneValue?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = parties.find((p) => p.id === value);
  const isNone = value === noneValue;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">
            {selected ? selected.name : noneLabel && isNone ? noneLabel : "Select party…"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>No match found.</CommandEmpty>
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
              {parties.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.name} ${p.phone} ${p.email ?? ""} ${p.pan ?? ""}`}
                  onSelect={() => {
                    onChange(p.id);
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
