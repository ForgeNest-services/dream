import { MediaPicker } from "@/components/inventory/media-picker";
import { CategoryCombobox, BrandCombobox } from "@/components/inventory/category-combobox";
import { Money } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/context/app-store";
import { generateBarcode } from "@/lib/barcode";
import { Barcode, Plus, Trash2, X } from "lucide-react";

export interface DraftRow {
  key: string;
  /** set when the row maps to an existing variant */
  variantId?: string | undefined;
  name: string;
  modelNo: string;
  barcode: string;
  unitId: string;
  qty: number;
  unitCost: number;
  sellingPrice: number;
  lowStockAt: number;
  expiryDate: string;
}

export interface DraftItem {
  key: string;
  kind: "existing" | "new";
  productId?: string | undefined;
  name: string;
  sku: string;
  categoryId: string;
  brandId: string;
  mediaId?: string | undefined;
  /** only meaningful for kind: "new" — existing items use the product's own taxable/taxRate */
  taxable: boolean;
  taxRate?: number | undefined;
  rows: DraftRow[];
}

let rowSeq = 0;
export const newRowKey = () => `r${++rowSeq}`;

export function emptyRow(unitId: string): DraftRow {
  return {
    key: newRowKey(),
    name: "",
    modelNo: "",
    barcode: "",
    unitId,
    qty: 1,
    unitCost: 0,
    sellingPrice: 0,
    lowStockAt: 10,
    expiryDate: "",
  };
}

export function PurchaseItemCard({
  index,
  item,
  onChange,
  onRemove,
}: {
  index: number;
  item: DraftItem;
  onChange: (next: DraftItem) => void;
  onRemove: () => void;
}) {
  const app = useApp();
  const unitId = app.units[0]?.id ?? "";

  const existingProduct =
    item.kind === "existing" ? app.products.find((p) => p.id === item.productId) : undefined;
  const taxable =
    app.company.vatRegistered &&
    (item.kind === "existing" ? existingProduct?.taxable !== false : item.taxable);
  const taxRate = taxable
    ? item.kind === "existing"
      ? (existingProduct?.taxRate ?? app.company.vatRate)
      : (item.taxRate ?? app.company.vatRate)
    : 0;
  const costInclTax = (excl: number) => (taxable ? excl + (excl * taxRate) / 100 : excl);
  const costExclTax = (incl: number) => (taxable ? incl / (1 + taxRate / 100) : incl);

  const setRow = (key: string, patch: Partial<DraftRow>) =>
    onChange({
      ...item,
      rows: item.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    });

  const pickProduct = (productId: string) => {
    const p = app.products.find((x) => x.id === productId);
    const rows = app.variantsOf(productId).map<DraftRow>((v) => ({
      key: newRowKey(),
      variantId: v.id,
      name: v.name,
      modelNo: v.modelNo,
      barcode: v.barcode,
      unitId: v.unitId,
      qty: 0,
      unitCost: v.costPrice,
      sellingPrice: v.sellingPrice,
      lowStockAt: v.lowStockAt,
      expiryDate: v.expiryDate ?? "",
    }));
    onChange({
      ...item,
      productId,
      name: p?.name ?? "",
      sku: p?.sku ?? "",
      categoryId: p?.categoryId ?? "",
      brandId: p?.brandId ?? "none",
      mediaId: p?.mediaId,
      rows,
    });
  };

  const lineTotal = item.rows.reduce((s, r) => s + r.qty * r.unitCost, 0);

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-muted text-xs font-medium">
          {index + 1}
        </span>
        <Select
          value={item.kind}
          onValueChange={(v) =>
            onChange({
              ...item,
              kind: v as DraftItem["kind"],
              productId: undefined,
              name: "",
              sku: "",
              rows: v === "new" ? [emptyRow(unitId)] : [],
            })
          }
        >
          <SelectTrigger className="h-8 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="existing">Existing product</SelectItem>
            <SelectItem value="new">New product</SelectItem>
          </SelectContent>
        </Select>

        {item.kind === "existing" ? (
          <Select value={item.productId ?? ""} onValueChange={pickProduct}>
            <SelectTrigger className="h-8 min-w-56 flex-1">
              <SelectValue placeholder="Choose product…" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {app.products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} · {p.sku}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={item.name}
            onChange={(e) => onChange({ ...item, name: e.target.value })}
            placeholder="Product name (e.g. PPR Elbow 90°)"
            className="h-8 min-w-56 flex-1"
          />
        )}

        <span className="num text-sm text-muted-foreground">
          <Money value={lineTotal} />
        </span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove} aria-label="Remove item">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {item.kind === "new" && (
        <div className="grid gap-3 border-b p-3 sm:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">SKU</Label>
            <Input
              value={item.sku}
              onChange={(e) => onChange({ ...item, sku: e.target.value })}
              placeholder="Auto if blank"
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Category</Label>
            <CategoryCombobox
              value={item.categoryId}
              onChange={(v) => onChange({ ...item, categoryId: v })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Brand</Label>
            <BrandCombobox value={item.brandId} onChange={(v) => onChange({ ...item, brandId: v })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Image</Label>
            <MediaPicker
              value={item.mediaId}
              onChange={(id) => onChange({ ...item, mediaId: id })}
            />
          </div>
          {app.company.vatRegistered && (
            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch
                checked={item.taxable}
                onCheckedChange={(v) => onChange({ ...item, taxable: v })}
              />
              <Label className="text-xs">Taxable</Label>
            </div>
          )}
          {app.company.vatRegistered && item.taxable && (
            <div className="space-y-1">
              <Label className="text-xs">Tax rate (%)</Label>
              <Input
                type="number"
                value={item.taxRate ?? app.company.vatRate}
                onChange={(e) =>
                  onChange({
                    ...item,
                    taxRate: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
                className="h-8"
              />
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto p-3">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="py-1 text-left font-medium">Variant</th>
              <th className="py-1 text-left font-medium">Model</th>
              <th className="py-1 text-left font-medium">Barcode</th>
              <th className="py-1 text-left font-medium">Unit</th>
              <th className="py-1 text-right font-medium">Qty</th>
              <th className="py-1 text-right font-medium">Cost (exc. VAT)</th>
              {taxable && <th className="py-1 text-right font-medium">Cost (inc. VAT)</th>}
              <th className="py-1 text-right font-medium">Selling</th>
              <th className="py-1 text-left font-medium">Expiry</th>
              <th className="py-1 text-right font-medium">Amount</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {item.rows.length === 0 ? (
              <tr>
                <td colSpan={taxable ? 11 : 10} className="py-3 text-center text-xs text-muted-foreground">
                  Choose a product to load its variants.
                </td>
              </tr>
            ) : (
              item.rows.map((r) => (
                <tr key={r.key} className="border-t border-border/60">
                  <td className="py-1.5 pr-2">
                    <Input
                      value={r.name}
                      onChange={(e) => setRow(r.key, { name: e.target.value })}
                      placeholder="Default"
                      className="h-8 min-w-28"
                      disabled={item.kind === "existing"}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input
                      value={r.modelNo}
                      onChange={(e) => setRow(r.key, { modelNo: e.target.value })}
                      className="num h-8 min-w-24"
                      disabled={item.kind === "existing"}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <div className="flex items-center gap-1">
                      <Input
                        value={r.barcode}
                        onChange={(e) => setRow(r.key, { barcode: e.target.value })}
                        className="num h-8 min-w-32"
                        disabled={item.kind === "existing"}
                      />
                      {item.kind === "new" && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          aria-label="Generate barcode"
                          onClick={() => setRow(r.key, { barcode: generateBarcode() })}
                        >
                          <Barcode className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                  <td className="py-1.5 pr-2">
                    <Select
                      value={r.unitId}
                      onValueChange={(v) => setRow(r.key, { unitId: v })}
                      disabled={item.kind === "existing"}
                    >
                      <SelectTrigger className="h-8 w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {app.units.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.symbol}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input
                      type="number"
                      value={r.qty}
                      onChange={(e) => setRow(r.key, { qty: Number(e.target.value) || 0 })}
                      className="num h-8 w-20 text-right"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input
                      type="number"
                      value={r.unitCost}
                      onChange={(e) => setRow(r.key, { unitCost: Number(e.target.value) || 0 })}
                      className="num h-8 w-24 text-right"
                    />
                  </td>
                  {taxable && (
                    <td className="py-1.5 pr-2">
                      <Input
                        type="number"
                        value={costInclTax(r.unitCost).toFixed(2)}
                        onChange={(e) =>
                          setRow(r.key, { unitCost: costExclTax(Number(e.target.value) || 0) })
                        }
                        className="num h-8 w-24 text-right"
                      />
                    </td>
                  )}
                  <td className="py-1.5 pr-2">
                    <Input
                      type="number"
                      value={r.sellingPrice}
                      onChange={(e) => setRow(r.key, { sellingPrice: Number(e.target.value) || 0 })}
                      className="num h-8 w-24 text-right"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input
                      type="date"
                      value={r.expiryDate}
                      onChange={(e) => setRow(r.key, { expiryDate: e.target.value })}
                      className="h-8 min-w-36"
                    />
                  </td>
                  <td className="py-1.5 pr-2 text-right">
                    <Money value={r.qty * r.unitCost} />
                  </td>
                  <td className="py-1.5">
                    {item.kind === "new" && item.rows.length > 1 ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        aria-label="Remove variant"
                        onClick={() =>
                          onChange({ ...item, rows: item.rows.filter((x) => x.key !== r.key) })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {item.kind === "new" && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => onChange({ ...item, rows: [...item.rows, emptyRow(unitId)] })}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add variant
          </Button>
        )}
      </div>
    </div>
  );
}
