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
import { Textarea } from "@/components/ui/textarea";
import { generateBarcode } from "@/lib/barcode";
import { useApp } from "@/context/app-store";
import type { Product, Variant } from "@/data/types";
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

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState<string>("none");
  const [mediaId, setMediaId] = useState<string | undefined>(undefined);
  const [description, setDescription] = useState("");
  const [variants, setVariants] = useState<DraftVariant[]>([]);

  useEffect(() => {
    if (!open) return;
    if (product) {
      setName(product.name);
      setSku(product.sku);
      setCategoryId(product.categoryId);
      setBrandId(product.brandId ?? "none");
      setMediaId(product.mediaId);
      setDescription(product.description ?? "");
      setVariants(
        app.variantsOf(product.id).map((v) => ({
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
        })),
      );
    } else {
      setName("");
      setSku("");
      setCategoryId(app.categories[0]?.id ?? "");
      setBrandId("none");
      setMediaId(undefined);
      setDescription("");
      setVariants([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?.id]);

  const [baseCost, setBaseCost] = useState(0);
  const [basePrice, setBasePrice] = useState(0);
  const [baseUnit, setBaseUnit] = useState("");

  useEffect(() => {
    if (open && !product) {
      setBaseCost(0);
      setBasePrice(0);
      setBaseUnit(app.units[0]?.id ?? "");
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
        costPrice: baseCost,
        sellingPrice: basePrice,
        lowStockAt: 10,
      },
    ]);

  const patchVariant = (i: number, patch: Partial<DraftVariant>) =>
    setVariants((vs) => vs.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));

  const submit = () => {
    if (!name.trim() || !categoryId) {
      toast.error("Product name and category are required");
      return;
    }
    const payload = {
      name: name.trim(),
      sku: sku.trim() || `SKU-${Date.now().toString(36).toUpperCase()}`,
      categoryId,
      brandId: brandId === "none" ? undefined : brandId,
      mediaId,
      description: description.trim() || undefined,
    };

    if (product) {
      const existing = app.variantsOf(product.id);
      const merged: Variant[] = variants.map((v, i) => {
        const prev = existing.find((e) => e.id === v.id);
        return {
          id: v.id ?? `${product.id}-v${existing.length + i + 1}`,
          productId: product.id,
          name: v.name || "Default",
          modelNo: v.modelNo,
          barcode: v.barcode,
          unitId: v.unitId,
          purchaseUnitId: v.purchaseUnitId,
          conversionFactor: v.conversionFactor,
          costPrice: Number(v.costPrice) || 0,
          sellingPrice: Number(v.sellingPrice) || 0,
          lowStockAt: Number(v.lowStockAt) || 0,
          stock: prev?.stock ?? Object.fromEntries(app.branches.map((b) => [b.id, 0])),
        };
      });
      app.updateProduct(product.id, payload, merged);
      toast.success("Product updated");
    } else {
      const vs = (
        variants.length > 0
          ? variants
          : [
              {
                name: "Default",
                modelNo: sku,
                barcode: "",
                unitId: baseUnit || app.units[0]!.id,
                costPrice: baseCost,
                sellingPrice: basePrice,
                lowStockAt: 10,
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
      }));
      app.addProduct(payload, vs);
      toast.success("Product created — stock starts at 0, use Restock to add stock");
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit product" : "Add new product"}</DialogTitle>
          <DialogDescription>
            Stock levels are never edited here — use Adjust stock or Restock.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Product name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CPVC Elbow 1/2 inch" />
          </div>
          <div className="space-y-1.5">
            <Label>SKU</Label>
            <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Auto if empty" />
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

        {!editing ? (
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Default pricing — used when no variants are added
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Cost price</Label>
                <Input
                  type="number"
                  value={baseCost}
                  onChange={(e) => setBaseCost(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Selling price</Label>
                <Input
                  type="number"
                  value={basePrice}
                  onChange={(e) => setBasePrice(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
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
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-sm font-medium">Variants</p>
            <Button type="button" size="sm" variant="outline" onClick={addVariant}>
              <Plus className="mr-1.5 h-4 w-4" /> Add variant
            </Button>
          </div>
          {variants.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No variants — a “Default” variant will be created automatically.
            </p>
          ) : (
            <div className="space-y-3 p-3">
              {variants.map((v, i) => (
                <div key={v.id ?? i} className="grid gap-2 rounded-md border p-3 sm:grid-cols-7">
                  <Input
                    className="sm:col-span-2"
                    placeholder="Variant name"
                    value={v.name}
                    onChange={(e) => patchVariant(i, { name: e.target.value })}
                  />
                  <Input
                    placeholder="Model no."
                    value={v.modelNo}
                    onChange={(e) => patchVariant(i, { modelNo: e.target.value })}
                  />
                  <div className="flex gap-1">
                    <Input
                      placeholder="Barcode"
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
                    placeholder="Cost"
                    value={v.costPrice}
                    onChange={(e) => patchVariant(i, { costPrice: Number(e.target.value) })}
                  />
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Price"
                      value={v.sellingPrice}
                      onChange={(e) => patchVariant(i, { sellingPrice: Number(e.target.value) })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setVariants((vs) => vs.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>{editing ? "Save changes" : "Create product"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
