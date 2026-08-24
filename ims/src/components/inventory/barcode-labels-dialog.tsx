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
import { useEffect, useState } from "react";

// Sized for a standard 3x8 A4 adhesive label sheet (24 labels/sheet, no
// gaps between cells): 3 * 70mm = 210mm (full A4 width, 0 side margin),
// 8 * 33mm = 264mm, leaving 33mm of vertical slack split as 10mm top/bottom
// margins (284mm < 297mm A4 height, comfortably one page for a full sheet).
const LABEL_WIDTH_MM = 70;
const LABEL_HEIGHT_MM = 33;
const LABELS_PER_PAGE = 24;

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

  const labels = variants.flatMap((v) =>
    Array.from({ length: Math.max(1, Math.min(24, copies)) }, (_, i) => ({
      key: `${v.id}-${i}`,
      name: `${product?.name ?? ""} — ${v.name}`,
      price: v.sellingPrice,
      code: v.barcode || v.modelNo || v.id,
    })),
  );

  // @page is document-level and can't be scoped by a class — inject/remove
  // a print-only stylesheet while this dialog is open, same technique
  // print.$invoiceId.tsx uses for its A4/thermal toggle.
  useEffect(() => {
    if (!open) return;
    const style = document.createElement("style");
    style.textContent = `@media print { @page { size: A4 portrait; margin: 10mm 0; } }`;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, [open]);

  const sheets = Math.ceil(labels.length / LABELS_PER_PAGE) || 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader className="no-print">
          <DialogTitle>Barcode labels — {product?.name}</DialogTitle>
        </DialogHeader>

        <div className="no-print flex items-end gap-3">
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
            {variants.length} variant(s) · {labels.length} labels · {sheets} sheet
            {sheets === 1 ? "" : "s"} (3×8 A4 label sheet, 24/sheet)
          </p>
        </div>

        <div className="max-h-[55vh] overflow-y-auto rounded-md border bg-white p-3 print:max-h-none print:overflow-visible print:border-0 print:p-0">
          <div id="barcode-sheet" className="barcode-print-grid">
            {labels.map((l) => (
              <div key={l.key} className="barcode-print-cell">
                <p className="line-clamp-2 text-[9px] font-medium leading-tight text-black">
                  {l.name}
                </p>
                <Barcode value={l.code} height={34} moduleWidth={1.1} />
                <p className="num text-[10px] font-semibold text-black">
                  {formatMoney(l.price, app.currency)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="no-print">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="mr-1.5 h-4 w-4" /> Print labels
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
