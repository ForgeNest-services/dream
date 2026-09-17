import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Package } from "lucide-react";
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
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useProducts } from "@/hooks/useProducts";
import { cn } from "@/lib/utils";

// Searchable product picker for purchase/sale flows. Product matching is
// performed by the backend so products outside the app-store cache are found.
export function ProductCombobox({
  value,
  onChange,
  placeholder = "Search by name, SKU, model, barcode…",
  triggerClassName,
}: {
  value: string | undefined;
  onChange: (productId: string) => void;
  placeholder?: string;
  triggerClassName?: string;
}) {
  const app = useApp();
  const { syncProducts } = app;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);
  const { products, isLoading } = useProducts({
    ...(debouncedQ.trim() ? { q: debouncedQ.trim() } : {}),
    page: 1,
    per_page: 50,
  });

  useEffect(() => {
    syncProducts(products);
  }, [products, syncProducts]);

  const selected = value
    ? (products.find((p) => p.id === value) ?? app.products.find((p) => p.id === value))
    : undefined;

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
          className={cn("justify-between font-normal", triggerClassName)}
        >
          <span className="min-w-0 flex-1 truncate text-left">
            {selected ? (
              <span className="inline-flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 shrink-0 opacity-60" />
                <span className="truncate">{selected.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">· {selected.sku}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Choose product…</span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-88 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={placeholder} value={q} onValueChange={setQ} />
          <CommandList className="max-h-80">
            {!isLoading && products.length === 0 && (
              <CommandEmpty>No product matches.</CommandEmpty>
            )}
            <CommandGroup>
              {isLoading && (
                <div className="px-3 py-2 text-sm text-muted-foreground">Searching products…</div>
              )}
              {products.map((product) => {
                const modelNumbers = [
                  ...new Set(product.variants.map((variant) => variant.model_no).filter(Boolean)),
                ];
                const meta = [
                  product.sku,
                  modelNumbers.length > 0 ? `Model ${modelNumbers.join(", ")}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <CommandItem
                    key={product.id}
                    value={product.id}
                    onSelect={() => {
                      onChange(product.id);
                      setOpen(false);
                    }}
                    className="items-start"
                  >
                    <Check
                      className={cn(
                        "mr-2 mt-0.5 h-4 w-4 shrink-0",
                        value === product.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{product.name}</span>
                      {meta && (
                        <span className="block truncate text-xs text-muted-foreground">{meta}</span>
                      )}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
