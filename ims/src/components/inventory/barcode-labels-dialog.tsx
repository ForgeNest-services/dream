import { Barcode } from "@/components/inventory/barcode";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/context/app-store";
import { formatMoney } from "@/lib/format";
import { Printer } from "lucide-react";
import { useState } from "react";

// Printing happens on a dedicated /print/labels route, not from inside this
// dialog — Radix Dialog content is `position: fixed`, which clips/breaks
// print pagination (only whatever fits one screen "page" prints, the rest
// is silently cut off) and its built-in close (X) button can't be hidden
// from here. This dialog is just a preview + copies picker.
export function BarcodeLabelsDialog({
  productId,
  open,
  onOpenChange,
}: {
  productId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const app = useApp();
  const [copies, setCopies] = useState(4);
  const product = app.products.find((p) => p.id === productId);
  const variants = productId ? app.variantsOf(productId) : [];

  const previewLabels = variants.map((v) => ({
    key: v.id,
    name: `${product?.name ?? ""} — ${v.name}`,
    price: v.sellingPrice,
    code: v.barcode || v.modelNo || v.id,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Barcode labels — {product?.name}</DialogTitle>
        </DialogHeader>

        <div className="flex items-end gap-3">
          <div>
            <Label className="text-xs">Copies per variant</Label>
            <Input
              type="number"
              min={1}
              max={24}
              value={copies}
              onChange={(e) => setCopies(Number(e.target.value) || 1)}
              className="num mt-1 w-28"
            />
          </div>
          <p className="pb-2 text-xs text-muted-foreground">
            {variants.length} variant(s) · {variants.length * Math.max(1, Math.min(24, copies))} labels
            total (3×8 A4 label sheet, 24/sheet)
          </p>
        </div>

        <div className="grid max-h-[45vh] grid-cols-2 gap-2 overflow-y-auto rounded-md border bg-white p-3 sm:grid-cols-3">
          {previewLabels.map((l) => (
            <div
              key={l.key}
              className="flex flex-col items-center gap-1 rounded border border-dashed border-neutral-300 p-2 text-center"
            >
              <p className="line-clamp-2 text-[10px] font-medium text-black">{l.name}</p>
              <Barcode value={l.code} height={38} moduleWidth={1.2} />
              <p className="num text-[11px] font-semibold text-black">
                {formatMoney(l.price, app.currency)}
              </p>
            </div>
          ))}
        </div>
        {previewLabels.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">No variants to label.</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            disabled={!productId || previewLabels.length === 0}
            onClick={() => {
              if (!productId) return;
              const url = `/print/labels?productId=${encodeURIComponent(productId)}&copies=${Math.max(1, Math.min(24, copies))}`;
              window.open(url, "_blank");
              onOpenChange(false);
            }}
          >
            <Printer className="mr-1.5 h-4 w-4" /> Print labels
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
