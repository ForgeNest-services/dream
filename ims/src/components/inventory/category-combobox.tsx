import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
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
import { useApp } from "@/context/app-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Categories/brands are already fully loaded client-side (app.categories /
// app.brands), unlike parties — so this filters locally instead of querying
// the backend per keystroke. The "+ Create …" row lets a shopkeeper add a
// missing category or brand without leaving the product form.

export function CategoryCombobox({
  value,
  onChange,
  placeholder = "Select category…",
}: {
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const app = useApp();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);

  const selected = app.categories.find((c) => c.id === value);
  const matches = app.categories.filter((c) =>
    app.categoryPath(c.id).toLowerCase().includes(q.trim().toLowerCase()),
  );
  const exactMatch = app.categories.some(
    (c) => c.name.toLowerCase() === q.trim().toLowerCase(),
  );

  const createAndSelect = async () => {
    const name = q.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const res = await app.addCategory(name, null);
      if (!res.ok || !res.category) {
        toast.error(res.error ?? "Failed to create category");
        return;
      }
      onChange(res.category.id);
      toast.success(`Category "${name}" created`);
      setOpen(false);
      setQ("");
    } finally {
      setCreating(false);
    }
  };

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
            {selected ? app.categoryPath(selected.id) : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search or create category…" value={q} onValueChange={setQ} />
          <CommandList>
            {matches.length === 0 && !q.trim() && <CommandEmpty>No categories yet.</CommandEmpty>}
            <CommandGroup>
              {matches.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.id}
                  onSelect={() => {
                    onChange(c.id);
                    setOpen(false);
                    setQ("");
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === c.id ? "opacity-100" : "opacity-0")} />
                  {app.categoryPath(c.id)}
                </CommandItem>
              ))}
            </CommandGroup>
            {q.trim() && !exactMatch && (
              <CommandGroup>
                <CommandItem value={`__create__${q}`} onSelect={createAndSelect} disabled={creating}>
                  <Plus className="mr-2 h-4 w-4" />
                  {creating ? "Creating…" : `Create "${q.trim()}"`}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function BrandCombobox({
  value,
  onChange,
  allowNone = true,
  placeholder = "Select brand…",
}: {
  value: string;
  onChange: (id: string) => void;
  allowNone?: boolean;
  placeholder?: string;
}) {
  const app = useApp();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);

  const isNone = value === "none";
  const selected = app.brands.find((b) => b.id === value);
  const matches = app.brands.filter((b) => b.name.toLowerCase().includes(q.trim().toLowerCase()));
  const exactMatch = app.brands.some((b) => b.name.toLowerCase() === q.trim().toLowerCase());

  const createAndSelect = async () => {
    const name = q.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const res = await app.addBrand(name);
      if (!res.ok || !res.brand) {
        toast.error(res.error ?? "Failed to create brand");
        return;
      }
      onChange(res.brand.id);
      toast.success(`Brand "${name}" created`);
      setOpen(false);
      setQ("");
    } finally {
      setCreating(false);
    }
  };

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
            {selected ? selected.name : isNone ? "No brand" : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search or create brand…" value={q} onValueChange={setQ} />
          <CommandList>
            {matches.length === 0 && !q.trim() && <CommandEmpty>No brands yet.</CommandEmpty>}
            <CommandGroup>
              {allowNone && (
                <CommandItem
                  value="__none__"
                  onSelect={() => {
                    onChange("none");
                    setOpen(false);
                    setQ("");
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", isNone ? "opacity-100" : "opacity-0")} />
                  No brand
                </CommandItem>
              )}
              {matches.map((b) => (
                <CommandItem
                  key={b.id}
                  value={b.id}
                  onSelect={() => {
                    onChange(b.id);
                    setOpen(false);
                    setQ("");
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === b.id ? "opacity-100" : "opacity-0")} />
                  {b.name}
                </CommandItem>
              ))}
            </CommandGroup>
            {q.trim() && !exactMatch && (
              <CommandGroup>
                <CommandItem value={`__create__${q}`} onSelect={createAndSelect} disabled={creating}>
                  <Plus className="mr-2 h-4 w-4" />
                  {creating ? "Creating…" : `Create "${q.trim()}"`}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
