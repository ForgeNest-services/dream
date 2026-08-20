import { MediaPicker } from "@/components/inventory/media-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { generateBarcode } from "@/lib/barcode";
import { useApp } from "@/context/app-store";
import type { Product } from "@/data/types";
import { Barcode, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface DraftVariant {
  id?: string | undefined;
  name: string;
  modelNo: string;
  barcode: string;
  unitId: string;
  purchaseUnitId?: string | undefined;
  conversionFactor?: number | undefined;
  costPrice: number;
  sellingPrice: number;
  lowStockAt: number;
  /** Only meaningful for new products — ignored when editing. */
  initialStock: number;
}

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product?: Product | undefined;
}) {
  const app = useApp();
  const editing = Boolean(product);
  const defaultBranch = app.branchId === "all" ? (app.branches[0]?.id ?? "") : app.branchId;

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState<string>("none");
  const [mediaId, setMediaId] = useState<string | undefined>(undefined);
  const [description, setDescription] = useState("");
  const [hasVariants, setHasVariants] = useState(false);
  const [variants, setVariants] = useState<DraftVariant[]>([]);
  const [taxable, setTaxable] = useState(true);
  const [taxRate, setTaxRate] = useState<number | "">("");

  useEffect(() => {
    if (!open) return;
    if (product) {
      const existingVariants = app.variantsOf(product.id);
      setName(product.name);
      setSku(product.sku);
      setCategoryId(product.categoryId);
      setBrandId(product.brandId ?? "none");
      setMediaId(product.mediaId);
      setDescription(product.description ?? "");
      setTaxable(product.taxable !== false);
      setTaxRate(product.taxRate ?? app.company.vatRate);
      setHasVariants(
        existingVariants.length > 1 || (existingVariants[0]?.name ?? "Default") !== "Default",
      );
      setVariants(
        existingVariants.map((v) => ({
          id: v.id,
          name: v.name,
          modelNo: v.modelNo,
          barcode: v.barcode,
          unitId: v.unitId,
          purchaseUnitId: v.purchaseUnitId,
          conversionFactor: v.conversionFactor,
          costPrice: v.costPrice,
          sellingPrice: v.sellingPrice,
          lowStockAt: v.lowStockAt,
          initialStock: 0,
        })),
      );
    } else {
      setName("");
      setSku("");
      setCategoryId(app.categories[0]?.id ?? "");
      setBrandId("none");
      setMediaId(undefined);
      setDescription("");
      setTaxable(true);
      setTaxRate(app.company.vatRate);
      setHasVariants(false);
      setVariants([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?.id]);

  const [baseCost, setBaseCost] = useState(0);
  const [basePrice, setBasePrice] = useState(0);
  const [baseUnit, setBaseUnit] = useState("");
  const [baseModelNo, setBaseModelNo] = useState("");
  const [baseBarcode, setBaseBarcode] = useState("");
  const [baseStock, setBaseStock] = useState(0);
  const [baseLowStockAt, setBaseLowStockAt] = useState(10);

  useEffect(() => {
    if (open && !product) {
      setBaseCost(0);
      setBasePrice(0);
      setBaseUnit(app.units[0]?.id ?? "");
      setBaseModelNo("");
      setBaseBarcode("");
      setBaseStock(0);
      setBaseLowStockAt(10);
    } else if (open && product) {
      const first = app.variantsOf(product.id)[0];
      setBaseCost(first?.costPrice ?? 0);
      setBasePrice(first?.sellingPrice ?? 0);
      setBaseUnit(first?.unitId ?? app.units[0]?.id ?? "");
      setBaseModelNo(first?.modelNo ?? "");
      setBaseBarcode(first?.barcode ?? "");
      setBaseLowStockAt(first?.lowStockAt ?? 10);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?.id]);

  const addVariant = () =>
    setVariants((vs) => [
      ...vs,
      {
        name: "",
        modelNo: "",
        barcode: "",
        unitId: baseUnit || app.units[0]!.id,
        costPrice: 0,
        sellingPrice: 0,
        lowStockAt: 10,
        initialStock: 0,
      },
    ]);

  const patchVariant = (i: number, patch: Partial<DraftVariant>) =>
    setVariants((vs) => vs.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));

  const effectiveRate = taxable ? (taxRate === "" ? app.company.vatRate : taxRate) : 0;
  const priceInclTax = (sellingPrice: number) =>
    taxable ? sellingPrice + (sellingPrice * effectiveRate) / 100 : sellingPrice;
  const priceExclTax = (inclTax: number) =>
    taxable ? inclTax / (1 + effectiveRate / 100) : inclTax;
  const gridCols = 7 + (taxable ? 1 : 0) + (!editing ? 1 : 0);
  const gridColsClass =
    {
      7: "sm:grid-cols-7",
      8: "sm:grid-cols-8",
      9: "sm:grid-cols-9",
    }[gridCols] ?? "sm:grid-cols-9";

  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!name.trim() || !categoryId) {
      toast.error("Product name and category are required");
      return;
    }
    if (hasVariants && variants.length === 0) {
      toast.error("Add at least one variant, or switch off \"Has variants\"");
      return;
    }
    const payload = {
      name: name.trim(),
      sku: sku.trim() || `SKU-${Date.now().toString(36).toUpperCase()}`,
      categoryId,
      brandId: brandId === "none" ? undefined : brandId,
      mediaId,
      description: description.trim() || undefined,
      taxable,
      taxRate: taxRate === "" || Number(taxRate) === app.company.vatRate ? undefined : Number(taxRate),
    };

    setSubmitting(true);
    try {
      if (product) {
        const existing = app.variantsOf(product.id);
        const sourceRows = hasVariants
          ? variants
          : [
              {
                id: existing[0]?.id,
                name: "Default",
                modelNo: baseModelNo,
                barcode: baseBarcode,
                unitId: baseUnit || app.units[0]!.id,
                costPrice: baseCost,
                sellingPrice: basePrice,
                lowStockAt: baseLowStockAt,
                initialStock: 0,
              },
            ];
        const rows = sourceRows.map((v) => ({
          id: v.id,
          name: v.name || "Default",
          modelNo: v.modelNo,
          barcode: v.barcode,
          unitId: v.unitId,
          purchaseUnitId: v.purchaseUnitId,
          conversionFactor: v.conversionFactor,
          costPrice: Number(v.costPrice) || 0,
          sellingPrice: Number(v.sellingPrice) || 0,
          lowStockAt: Number(v.lowStockAt) || 0,
        }));
        const res = await app.updateProduct(product.id, payload, rows);
        if (!res.ok) {
          toast.error(res.error ?? "Failed to update product");
          return;
        }
        toast.success("Product updated");
      } else {
        const vs = (
          hasVariants
            ? variants
            : [
                {
                  name: "Default",
                  modelNo: baseModelNo,
                  barcode: baseBarcode,
                  unitId: baseUnit || app.units[0]!.id,
                  costPrice: baseCost,
                  sellingPrice: basePrice,
                  lowStockAt: baseLowStockAt,
                  initialStock: baseStock,
                },
              ]
        ).map((v) => ({
          name: v.name || "Default",
          modelNo: v.modelNo,
          barcode: v.barcode,
          unitId: v.unitId,
          purchaseUnitId: v.purchaseUnitId,
          conversionFactor: v.conversionFactor,
          costPrice: Number(v.costPrice) || 0,
          sellingPrice: Number(v.sellingPrice) || 0,
          lowStockAt: Number(v.lowStockAt) || 0,
          initialStock: Number(v.initialStock) || 0,
        }));
        const res = await app.addProduct(payload, vs, defaultBranch);
        if (!res.ok) {
          toast.error(res.error ?? "Failed to create product");
          return;
        }
        const anyStock = vs.some((v) => v.initialStock > 0);
        toast.success(
          anyStock ? "Product created with opening stock" : "Product created — stock starts at 0",
        );
      }
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit product" : "Add new product"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Stock levels are never edited here — use Adjust stock or Restock."
              : "Set an opening stock quantity below if you already have this item on hand."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Product name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. CPVC Elbow 1/2 inch"
            />
          </div>
          <div className="space-y-1.5">
            <Label>SKU</Label>
            <Input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="Leave blank to auto-generate"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {app.categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {app.categoryPath(c.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Brand</Label>
            <Select value={brandId} onValueChange={setBrandId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No brand</SelectItem>
                {app.brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Product image</Label>
            <MediaPicker value={mediaId} onChange={setMediaId} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional notes shown on the product page"
            />
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center gap-3">
            <Switch checked={taxable} onCheckedChange={setTaxable} />
            <div>
              <p className="text-sm">Taxable</p>
              <p className="text-xs text-muted-foreground">
                {taxable
                  ? "VAT is added on top of the selling price below"
                  : "VAT exempt — no tax is added to the selling price"}
              </p>
            </div>
          </div>
          {taxable && (
            <div className="mt-3 max-w-56 space-y-1.5">
              <Label className="text-xs">Tax rate (%)</Label>
              <Input
                type="number"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder={`${app.company.vatRate}`}
              />
              <p className="text-xs text-muted-foreground">
                Defaults to the company's {app.company.vatRate}% rate — change only for items with a
                different rate.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 rounded-lg border p-3">
          <Switch checked={hasVariants} onCheckedChange={setHasVariants} />
          <div>
            <p className="text-sm">Has variants</p>
            <p className="text-xs text-muted-foreground">
              Turn on for items that come in different sizes, colors or models — each with its own
              price, barcode and stock. Leave off for a single-SKU item.
            </p>
          </div>
        </div>

        {!hasVariants ? (
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pricing &amp; stock
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Cost price</Label>
                <Input
                  type="number"
                  value={baseCost}
                  onChange={(e) => setBaseCost(Number(e.target.value))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Selling price (excl. tax)</Label>
                <Input
                  type="number"
                  value={basePrice}
                  onChange={(e) => setBasePrice(Number(e.target.value))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Price incl. tax{taxable ? ` (${effectiveRate}%)` : ""}
                </Label>
                <Input
                  type="number"
                  value={priceInclTax(basePrice).toFixed(2)}
                  onChange={(e) => setBasePrice(priceExclTax(Number(e.target.value)))}
                  disabled={!taxable}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Unit</Label>
                <Select value={baseUnit} onValueChange={setBaseUnit}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {app.units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.symbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Model no.</Label>
                <Input
                  placeholder="e.g. CE-90-RED"
                  value={baseModelNo}
                  onChange={(e) => setBaseModelNo(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Barcode</Label>
                <div className="flex gap-1">
                  <Input
                    placeholder="Scan or generate"
                    value={baseBarcode}
                    onChange={(e) => setBaseBarcode(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title="Generate barcode"
                    aria-label="Generate barcode"
                    onClick={() => setBaseBarcode(generateBarcode(`${name}-${sku}`))}
                  >
                    <Barcode className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {!editing && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Opening stock</Label>
                  <Input
                    type="number"
                    value={baseStock}
                    onChange={(e) => setBaseStock(Number(e.target.value))}
                    placeholder="0"
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <p className="text-sm font-medium">Variants</p>
              <Button type="button" size="sm" variant="outline" onClick={addVariant}>
                <Plus className="mr-1.5 h-4 w-4" /> Add variant
              </Button>
            </div>
            {variants.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No variants yet — add at least one (e.g. by size or color).
              </p>
            ) : (
              <div className="space-y-3 p-3">
                <div
                  className={`hidden gap-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid ${gridColsClass}`}
                >
                  <span className="sm:col-span-2">Variant name</span>
                  <span>Model no.</span>
                  <span>Barcode</span>
                  <span>Unit</span>
                  <span>Cost price</span>
                  <span>Selling price (excl. tax)</span>
                  {taxable && <span>Selling price (incl. tax)</span>}
                  {!editing && <span>Opening stock</span>}
                  <span className="sr-only">Actions</span>
                </div>
                {variants.map((v, i) => (
                  <div key={v.id ?? i} className={`grid items-center gap-2 rounded-md border p-3 ${gridColsClass}`}>
                    <Input
                      className="sm:col-span-2"
                      placeholder="e.g. Red / Large"
                      value={v.name}
                      onChange={(e) => patchVariant(i, { name: e.target.value })}
                    />
                    <Input
                      placeholder="e.g. CE-90-RED"
                      value={v.modelNo}
                      onChange={(e) => patchVariant(i, { modelNo: e.target.value })}
                    />
                    <div className="flex gap-1">
                      <Input
                        placeholder="Scan or generate"
                        value={v.barcode}
                        onChange={(e) => patchVariant(i, { barcode: e.target.value })}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        title="Generate barcode"
                        aria-label="Generate barcode"
                        onClick={() =>
                          patchVariant(i, {
                            barcode: generateBarcode(`${name}-${v.name}-${v.modelNo}-${i}`),
                          })
                        }
                      >
                        <Barcode className="h-4 w-4" />
                      </Button>
                    </div>
                    <Select value={v.unitId} onValueChange={(val) => patchVariant(i, { unitId: val })}>
                      <SelectTrigger>
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
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={v.costPrice}
                      onChange={(e) => patchVariant(i, { costPrice: Number(e.target.value) })}
                    />
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={v.sellingPrice}
                      onChange={(e) => patchVariant(i, { sellingPrice: Number(e.target.value) })}
                    />
                    {taxable && (
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={priceInclTax(v.sellingPrice).toFixed(2)}
                        onChange={(e) =>
                          patchVariant(i, { sellingPrice: priceExclTax(Number(e.target.value)) })
                        }
                      />
                    )}
                    {!editing && (
                      <Input
                        type="number"
                        placeholder="0"
                        value={v.initialStock}
                        onChange={(e) => patchVariant(i, { initialStock: Number(e.target.value) })}
                      />
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setVariants((vs) => vs.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Saving…" : editing ? "Save changes" : "Create product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
