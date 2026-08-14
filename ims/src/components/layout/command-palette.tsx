import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useApp } from "@/context/app-store";
import { useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  Boxes,
  FileText,
  LayoutDashboard,
  PackagePlus,
  Receipt,
  Settings,
  ShoppingCart,
  Users,
} from "lucide-react";
import { useEffect } from "react";

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const app = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const go = (to: string) => {
    onOpenChange(false);
    void navigate({ to: to as never });
  };

  const pages = [
    { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, mod: "dashboard" },
    { label: "Products", to: "/inventory/products", icon: Boxes, mod: "inventory" },
    { label: "Categories", to: "/inventory/categories", icon: Boxes, mod: "inventory" },
    { label: "Media Center", to: "/inventory/media", icon: Boxes, mod: "inventory" },
    { label: "Stock Movements", to: "/inventory/movements", icon: Boxes, mod: "inventory" },
    { label: "Point of Sale", to: "/sales/pos", icon: ShoppingCart, mod: "sales" },
    { label: "Invoices", to: "/sales/invoices", icon: Receipt, mod: "sales" },
    { label: "Quotations", to: "/sales/quotations", icon: FileText, mod: "sales" },
    { label: "Customers", to: "/parties/customers", icon: Users, mod: "parties" },
    { label: "Suppliers", to: "/parties/suppliers", icon: Users, mod: "parties" },
    { label: "Reports", to: "/reports", icon: BarChart3, mod: "reports" },
    { label: "Settings", to: "/settings", icon: Settings, mod: "settings" },
  ].filter((p) => app.modules.includes(p.mod as never));

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search products, invoices, customers or jump to a screen…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Actions">
          {app.can("stock.restock") && (
            <CommandItem onSelect={() => go("/inventory/products")}>
              <PackagePlus className="mr-2 h-4 w-4" /> Restock an item
            </CommandItem>
          )}
          {app.can("sale.create") && (
            <CommandItem onSelect={() => go("/sales/pos")}>
              <ShoppingCart className="mr-2 h-4 w-4" /> New sale
            </CommandItem>
          )}
          {app.can("sale.create") && (
            <CommandItem onSelect={() => go("/sales/quotations")}>
              <FileText className="mr-2 h-4 w-4" /> New quotation
            </CommandItem>
          )}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Go to">
          {pages.map((p) => (
            <CommandItem key={p.to} onSelect={() => go(p.to)}>
              <p.icon className="mr-2 h-4 w-4" /> {p.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {app.modules.includes("inventory") && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Products">
              {app.products.slice(0, 8).map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.name} ${p.sku}`}
                  onSelect={() => go(`/inventory/products/${p.id}`)}
                >
                  <Boxes className="mr-2 h-4 w-4" />
                  {p.name}
                  <span className="num ml-auto text-xs text-muted-foreground">{p.sku}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {app.modules.includes("sales") && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Invoices">
              {app.invoices.slice(0, 6).map((i) => (
                <CommandItem
                  key={i.id}
                  value={i.number}
                  onSelect={() => go(`/sales/invoices/${i.id}`)}
                >
                  <Receipt className="mr-2 h-4 w-4" />
                  <span className="num">{i.number}</span>
                  <span className="ml-auto text-xs capitalize text-muted-foreground">
                    {i.status}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
