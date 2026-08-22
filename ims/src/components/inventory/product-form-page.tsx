import { MediaPicker } from "@/components/inventory/media-picker";
import { CategoryCombobox, BrandCombobox } from "@/components/inventory/category-combobox";
import { ExpiryInput } from "@/components/inventory/expiry-input";
import { CostHistoryPanel } from "@/components/inventory/cost-history-panel";
import { Money, PageHeader } from "@/components/common/primitives";
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
import { Textarea } from "@/components/ui/textarea";
import { generateBarcode } from "@/lib/barcode";
import { useApp } from "@/context/app-store";
import type { Product } from "@/data/types";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Barcode, Plus, Trash2 } from "lucide-react";
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
  expiryDate: string;
  /** Only meaningful for new products — ignored when editing. */
  initialStock: number;
}

function margin(costPrice: number, sellingPrice: number): { pct: number; profit: number } {
  const profit = sellingPrice - costPrice;
  const pct = costPrice > 0 ? (profit / costPrice) * 100 : 0;
  return { pct, profit };
}

export function ProductFormPage({ product }: { product?: Product | undefined }) {
  const app = useApp();
  const navigate = useNavigate();
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
          expiryDate: v.expiryDate ?? "",
          initialStock: 0,
        })),
      );
    } else {
      setTaxRate(app.company.vatRate);
      setCategoryId(app.categories[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  const [baseCost, setBaseCost] = useState(0);
  const [basePrice, setBasePrice] = useState(0);
  const [baseUnit, setBaseUnit] = useState("");
  const [baseModelNo, setBaseModelNo] = useState("");
  const [baseBarcode, setBaseBarcode] = useState("");
  const [baseStock, setBaseStock] = useState(0);
  const [baseLowStockAt, setBaseLowStockAt] = useState(10);
  const [baseExpiryDate, setBaseExpiryDate] = useState("");

  useEffect(() => {
    if (!product) {
      setBaseUnit(app.units[0]?.id ?? "");
      return;
    }
    const first = app.variantsOf(product.id)[0];
    setBaseCost(first?.costPrice ?? 0);
    setBasePrice(first?.sellingPrice ?? 0);
    setBaseUnit(first?.unitId ?? app.units[0]?.id ?? "");
    setBaseModelNo(first?.modelNo ?? "");
    setBaseBarcode(first?.barcode ?? "");
    setBaseLowStockAt(first?.lowStockAt ?? 10);
    setBaseExpiryDate(first?.expiryDate ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

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
        expiryDate: "",
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

  const [submitting, setSubmitting] = useState(false);

  const goToList = () => navigate({ to: "/inventory/products" });

  const submit = async () => {
    if (!name.trim() || !categoryId) {
      toast.error("Product name and category are required");
      return;
    }
    if (hasVariants && variants.length === 0) {
      toast.error('Add at least one variant, or switch off "Has variants"');
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
                expiryDate: baseExpiryDate,
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
          expiryDate: v.expiryDate || undefined,
        }));
        const res = await app.updateProduct(product.id, payload, rows);
        if (!res.ok) {
          toast.error(res.error ?? "Failed to update product");
          return;
        }
        toast.success("Product updated");
        goToList();
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
                  expiryDate: baseExpiryDate,
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
          expiryDate: v.expiryDate || undefined,
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
        goToList();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-2">
        <Button variant="ghost" size="sm" onClick={goToList}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to products
        </Button>
      </div>
      <PageHeader
        title={editing ? `Edit ${product?.name}` : "Add new product"}
        subtitle={
          editing
            ? "Stock levels are never edited here — use Adjust stock or Restock."
            : "Set an opening stock quantity below if you already have this item on hand."
        }
        actions={
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Saving…" : editing ? "Save changes" : "Create product"}
          </Button>
        }
      />

      <div className="space-y-5">
        <div className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2">
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
            <CategoryCombobox value={categoryId} onChange={setCategoryId} />
          </div>
          <div className="space-y-1.5">
            <Label>Brand</Label>
            <BrandCombobox value={brandId} onChange={setBrandId} />
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

        <div className="rounded-lg border bg-muted/30 p-4">
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

        <div className="flex items-center gap-3 rounded-lg border p-4">
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
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pricing &amp; stock
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
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

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">
                  Selling price{taxable ? ` — VAT ${effectiveRate}%` : ""}
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground">
                      Exc. VAT
                    </span>
                    <Input
                      type="number"
                      className="pl-[4.5rem]"
                      value={basePrice}
                      onChange={(e) => setBasePrice(Number(e.target.value))}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground">
                      Inc. VAT
                    </span>
                    <Input
                      type="number"
                      className="pl-[4.5rem]"
                      value={priceInclTax(basePrice).toFixed(2)}
                      onChange={(e) => setBasePrice(priceExclTax(Number(e.target.value)))}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {taxable
                      ? "Either box works — the other recalculates. Only the exclusive amount is stored; VAT is added at sale time."
                      : "Non-VAT item — both amounts are the same."}
                  </p>
                  {basePrice > 0 && (
                    <MarginBadge cost={baseCost} price={basePrice} />
                  )}
                </div>
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
              <ExpiryInput value={baseExpiryDate} onChange={setBaseExpiryDate} />
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

            {editing && product && (
              <CostHistoryPanel variantId={app.variantsOf(product.id)[0]?.id} className="mt-4" />
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Variants</p>
              <Button type="button" size="sm" variant="outline" onClick={addVariant}>
                <Plus className="mr-1.5 h-4 w-4" /> Add variant
              </Button>
            </div>
            {variants.length === 0 ? (
              <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                No variants yet — add at least one (e.g. by size or color).
              </div>
            ) : (
              variants.map((v, i) => (
                <div key={v.id ?? i} className="rounded-lg border bg-card p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <Input
                      placeholder="Variant name — e.g. Red / Large"
                      value={v.name}
                      onChange={(e) => patchVariant(i, { name: e.target.value })}
                      className="max-w-xs font-medium"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setVariants((vs) => vs.filter((_, idx) => idx !== i))}
                      aria-label="Remove variant"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Model no.</Label>
                      <Input
                        placeholder="e.g. CE-90-RED"
                        value={v.modelNo}
                        onChange={(e) => patchVariant(i, { modelNo: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Barcode</Label>
                      <div className="flex gap-1">
                        <Input
                          value={v.barcode}
                          onChange={(e) => patchVariant(i, { barcode: e.target.value })}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
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
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Unit</Label>
                      <Select value={v.unitId} onValueChange={(val) => patchVariant(i, { unitId: val })}>
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
                      <Label className="text-xs">Cost price</Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={v.costPrice}
                        onChange={(e) => patchVariant(i, { costPrice: Number(e.target.value) })}
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
                      <Label className="text-xs">
                        Selling price{taxable ? ` — VAT ${effectiveRate}%` : ""}
                      </Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground">
                            Exc. VAT
                          </span>
                          <Input
                            type="number"
                            className="pl-[4.5rem]"
                            placeholder="0.00"
                            value={v.sellingPrice}
                            onChange={(e) => patchVariant(i, { sellingPrice: Number(e.target.value) })}
                          />
                        </div>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground">
                            Inc. VAT
                          </span>
                          <Input
                            type="number"
                            className="pl-[4.5rem]"
                            placeholder="0.00"
                            value={priceInclTax(v.sellingPrice).toFixed(2)}
                            onChange={(e) =>
                              patchVariant(i, { sellingPrice: priceExclTax(Number(e.target.value)) })
                            }
                          />
                        </div>
                      </div>
                      {v.sellingPrice > 0 && (
                        <div className="flex justify-end">
                          <MarginBadge cost={v.costPrice} price={v.sellingPrice} />
                        </div>
                      )}
                    </div>

                    <ExpiryInput
                      value={v.expiryDate}
                      onChange={(d) => patchVariant(i, { expiryDate: d })}
                      label="Expiry (optional)"
                    />
                    {!editing && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Opening stock</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={v.initialStock}
                          onChange={(e) => patchVariant(i, { initialStock: Number(e.target.value) })}
                        />
                      </div>
                    )}
                  </div>
                  {editing && v.id && <CostHistoryPanel variantId={v.id} className="mt-3" />}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MarginBadge({ cost, price }: { cost: number; price: number }) {
  const { pct, profit } = margin(cost, price);
  const positive = profit >= 0;
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium " +
        (positive
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "bg-destructive/10 text-destructive")
      }
    >
      {positive ? "+" : ""}
      <Money value={profit} /> margin ({pct.toFixed(0)}%)
    </span>
  );
}
