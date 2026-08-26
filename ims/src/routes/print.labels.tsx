import { Barcode } from "@/components/inventory/barcode";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/app-store";
import { formatMoney } from "@/lib/format";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Printer } from "lucide-react";
import { useEffect } from "react";

// Sized for a standard 3x8 A4 adhesive label sheet (24 labels/sheet, no
// gaps between cells): 3 * 70mm = 210mm (full A4 width, 0 side margin),
// 8 * 33mm = 264mm, leaving 33mm of vertical slack split as 10mm top/bottom
// margins (284mm < 297mm A4 height, comfortably one page for a full sheet).
const LABELS_PER_PAGE = 24;

interface LabelsSearch {
  productId: string;
  copies: number;
}

export const Route = createFileRoute("/print/labels")({
  head: () => ({
    meta: [{ title: "Print Barcode Labels — SROTA IMS" }],
  }),
  validateSearch: (search: Record<string, unknown>): LabelsSearch => ({
    productId: typeof search.productId === "string" ? search.productId : "",
    copies: Math.max(1, Math.min(24, Number(search.copies) || 4)),
  }),
  component: PrintLabelsPage,
});

// A dedicated route rather than printing from inside the picker dialog —
// Radix Dialog's content is `position: fixed`, which clips/breaks print
// pagination (only whatever fits one viewport-height "page" prints, the
// rest is silently cut off), and its built-in close (X) button can't be
// hidden from here since it's rendered by the shared Dialog component
// itself, not passed as children. A plain top-level route in normal
// document flow prints correctly across as many pages as needed, same
// approach print.$invoiceId.tsx already uses for invoices.
function PrintLabelsPage() {
  const app = useApp();
  const { productId, copies } = Route.useSearch();

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = "@media print { @page { size: A4 portrait; margin: 10mm 0; } }";
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const product = app.products.find((p) => p.id === productId);
  const variants = productId ? app.variantsOf(productId) : [];

  const labels = variants.flatMap((v) =>
    Array.from({ length: copies }, (_, i) => ({
      key: `${v.id}-${i}`,
      name: `${product?.name ?? ""} — ${v.name}`,
      price: v.sellingPrice,
      code: v.barcode || v.modelNo || v.id,
    })),
  );

  if (!product || labels.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6 text-center">
        <div>
          <p className="font-medium">Nothing to print</p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link to="/inventory/products">Back to products</Link>
          </Button>
        </div>
      </div>
    );
  }

  const sheets = Math.ceil(labels.length / LABELS_PER_PAGE);

  return (
    <div className="min-h-screen bg-muted/40 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[820px] flex-wrap items-center justify-between gap-2 px-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/inventory/products">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">
            {variants.length} variant(s) · {labels.length} labels · {sheets} sheet
            {sheets === 1 ? "" : "s"} (3×8 A4 label sheet, 24/sheet)
          </p>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      <div className="barcode-print-grid mx-auto max-w-[820px] bg-white p-3 print:max-w-none print:p-0">
        {labels.map((l) => (
          <div key={l.key} className="barcode-print-cell">
            <p className="line-clamp-2 text-[9px] font-medium leading-tight text-black">{l.name}</p>
            <Barcode value={l.code} height={34} moduleWidth={1.1} />
            <p className="num text-[10px] font-semibold text-black">
              {formatMoney(l.price, app.currency)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
