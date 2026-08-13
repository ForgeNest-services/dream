import { EmptyState, Money, PageHeader, Qty, StatusPill } from "@/components/common/primitives";
import { PaginationBar, usePagination } from "@/components/common/pagination";
import { MediaThumb } from "@/components/inventory/media-picker";
import { ProductFormDialog } from "@/components/inventory/product-form-dialog";
import { AdjustStockDialog, RestockDialog } from "@/components/inventory/stock-dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarcodeLabelsDialog } from "@/components/inventory/barcode-labels-dialog";
import { useApp } from "@/context/app-store";
import type { Product } from "@/data/types";
import { downloadCsv } from "@/lib/csv";
import { createFileRoute } from "@tanstack/react-router";
import {
  Barcode as BarcodeIcon,
  ChevronDown,
  ChevronRight,
  Download,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Fragment, useMemo, useState } from "react";

export const Route = createFileRoute("/_app/inventory/products")({
  head: () => ({
    meta: [
      { title: "Products & Variants — SROTA IMS" },
      {
        name: "description",
        content:
          "Browse products with variants, model numbers, barcodes, units, prices and live stock across branches.",
      },
      { property: "og:title", content: "Products & Variants — SROTA IMS" },
      {
        property: "og:description",
        content: "Product catalogue with variant-level pricing, units and branch stock.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const app = useApp();
  const [q, setQ] = useState("");
  const [barcode, setBarcode] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [brandId, setBrandId] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [labelsFor, setLabelsFor] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | undefined>(undefined);
  const [adjustFor, setAdjustFor] = useState<{ p: string; v: string } | null>(null);
  const [restockFor, setRestockFor] = useState<{ p: string; v: string } | null>(null);

  const descendantIds = (id: string): string[] => {
    const kids = app.categories.filter((c) => c.parentId === id);
    return [id, ...kids.flatMap((k) => descendantIds(k.id))];
  };

  const statusOf = (productId: string) => {
    const vs = app.variantsOf(productId);
    const total = vs.reduce((s, v) => s + app.stockOf(v), 0);
    if (total <= 0) return "out";
    if (vs.some((v) => app.stockOf(v) <= v.lowStockAt)) return "low";
    return "in-stock";
  };

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const code = barcode.trim().toLowerCase();
    const cats = categoryId === "all" ? null : new Set(descendantIds(categoryId));
    return app.products.filter((p) => {
      const vs = app.variantsOf(p.id);
      if (
        term &&
        !`${p.name} ${p.sku}`.toLowerCase().includes(term) &&
        !vs.some((v) => `${v.name} ${v.modelNo} ${v.barcode}`.toLowerCase().includes(term))
      )
        return false;
      if (code && !vs.some((v) => v.barcode.toLowerCase().includes(code))) return false;
      if (cats && !cats.has(p.categoryId)) return false;
      if (brandId !== "all" && p.brandId !== brandId) return false;
      if (stockFilter !== "all" && statusOf(p.id) !== stockFilter) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.products, app.variants, app.branchId, q, barcode, categoryId, brandId, stockFilter]);

  const { page, setPage, pageCount, slice, total, pageSize } = usePagination(rows, 10);

  const exportCsv = () =>
    downloadCsv(
      "products",
      rows.flatMap((p) =>
        app.variantsOf(p.id).map((v) => ({
          product: p.name,
          sku: p.sku,
          category: app.categoryPath(p.categoryId),
          brand: app.brands.find((b) => b.id === p.brandId)?.name ?? "",
          variant: v.name,
          model: v.modelNo,
          barcode: v.barcode,
          unit: app.unitSymbol(v.unitId),
          cost: v.costPrice,
          price: v.sellingPrice,
          stock: app.stockOf(v),
        })),
      ),
    );

  const canEdit = app.can("product.edit");

  return (
    <div>
      <PageHeader
        title="Products & Variants"
        subtitle={`${app.products.length} products · ${app.variants.length} variants`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="mr-1.5 h-4 w-4" /> CSV
            </Button>
            {app.can("stock.restock") ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRestockFor({ p: "", v: "" })}
              >
                <PackagePlus className="mr-1.5 h-4 w-4" /> Restock
              </Button>
            ) : null}
            {app.can("stock.adjust") ? (
              <Button variant="outline" size="sm" onClick={() => setAdjustFor({ p: "", v: "" })}>
                <SlidersHorizontal className="mr-1.5 h-4 w-4" /> Adjust stock
              </Button>
            ) : null}
            {canEdit ? (
              <Button
                size="sm"
                onClick={() => {
                  setEditing(undefined);
                  setFormOpen(true);
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Add product
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search name, SKU, model or barcode…"
            className="pl-8"
          />
        </div>
        <div className="relative w-56">
          <BarcodeIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={barcode}
            onChange={(e) => {
              setBarcode(e.target.value);
              setPage(1);
            }}
            placeholder="Scan / filter by barcode"
            className="num pl-8"
            aria-label="Filter by barcode"
          />
        </div>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">All categories</SelectItem>
            {app.categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {app.categoryPath(c.id)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={brandId} onValueChange={setBrandId}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Brand" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All brands</SelectItem>
            {app.brands.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stockFilter} onValueChange={setStockFilter}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any stock</SelectItem>
            <SelectItem value="in-stock">In stock</SelectItem>
            <SelectItem value="low">Low stock</SelectItem>
            <SelectItem value="out">Out of stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No products match these filters"
          description="Try clearing the search or switching category."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-8" />
                  <th className="px-3 py-2.5 text-left font-medium">Product</th>
                  <th className="px-3 py-2.5 text-left font-medium">Category</th>
                  <th className="px-3 py-2.5 text-left font-medium">Brand</th>
                  <th className="px-3 py-2.5 text-right font-medium">Stock</th>
                  <th className="px-3 py-2.5 text-right font-medium">Price range</th>
                  <th className="px-3 py-2.5 text-left font-medium">Status</th>
                  <th className="px-3 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {slice.map((p) => {
                  const vs = app.variantsOf(p.id);
                  const prices = vs.map((v) => v.sellingPrice);
                  const min = Math.min(...prices, 0 || Infinity);
                  const max = Math.max(...prices, 0);
                  const open = expanded[p.id] ?? false;
                  return (
                    <Fragment key={p.id}>
                      <tr className="border-t hover:bg-muted/30">
                        <td className="pl-2">
                          <button
                            type="button"
                            aria-label={open ? "Collapse variants" : "Expand variants"}
                            onClick={() => setExpanded((e) => ({ ...e, [p.id]: !open }))}
                            className="rounded p-1 text-muted-foreground hover:bg-muted"
                          >
                            {open ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-3">
                            <MediaThumb mediaId={p.mediaId} alt={p.name} className="h-10 w-10" />
                            <div>
                              <p className="font-medium">{p.name}</p>
                              <p className="num text-xs text-muted-foreground">
                                {p.sku} · {vs.length} variant{vs.length > 1 ? "s" : ""}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {app.categoryPath(p.categoryId)}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {app.brands.find((b) => b.id === p.brandId)?.name ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Qty value={app.productStock(p.id)} />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {min === max ? (
                            <Money value={max} />
                          ) : (
                            <span className="num">
                              <Money value={Number.isFinite(min) ? min : 0} /> – <Money value={max} />
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusPill status={statusOf(p.id)} />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex justify-end gap-1">
                            {app.can("stock.restock") ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setRestockFor({ p: p.id, v: "" })}
                              >
                                Restock
                              </Button>
                            ) : null}
                            {app.can("stock.adjust") ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setAdjustFor({ p: p.id, v: "" })}
                              >
                                Adjust
                              </Button>
                            ) : null}
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Print barcode labels"
                              title="Barcode labels"
                              onClick={() => setLabelsFor(p.id)}
                            >
                              <BarcodeIcon className="h-4 w-4" />
                            </Button>
                            {canEdit ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Edit product"
                                onClick={() => {
                                  setEditing(p);
                                  setFormOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {open ? (
                        <tr className="border-t bg-muted/20">
                          <td />
                          <td colSpan={7} className="px-3 py-3">
                            <table className="w-full text-xs">
                              <thead className="text-muted-foreground">
                                <tr>
                                  <th className="py-1 text-left font-medium">Variant</th>
                                  <th className="py-1 text-left font-medium">Model no.</th>
                                  <th className="py-1 text-left font-medium">Barcode</th>
                                  <th className="py-1 text-left font-medium">Unit</th>
                                  <th className="py-1 text-right font-medium">Cost</th>
                                  <th className="py-1 text-right font-medium">Selling</th>
                                  <th className="py-1 text-right font-medium">Stock</th>
                                </tr>
                              </thead>
                              <tbody>
                                {vs.map((v) => (
                                  <tr key={v.id} className="border-t border-border/60">
                                    <td className="py-1.5">{v.name}</td>
                                    <td className="num py-1.5">{v.modelNo || "—"}</td>
                                    <td className="num py-1.5">{v.barcode || "—"}</td>
                                    <td className="py-1.5">{app.unitSymbol(v.unitId)}</td>
                                    <td className="py-1.5 text-right">
                                      <Money value={v.costPrice} />
                                    </td>
                                    <td className="py-1.5 text-right">
                                      <Money value={v.sellingPrice} />
                                    </td>
                                    <td className="py-1.5 text-right">
                                      <Qty
                                        value={app.stockOf(v)}
                                        unit={app.unitSymbol(v.unitId)}
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={page}
            pageCount={pageCount}
            total={total}
            pageSize={pageSize}
            onChange={setPage}
          />
        </div>
      )}

      <BarcodeLabelsDialog
        productId={labelsFor}
        open={labelsFor !== null}
        onOpenChange={(o) => !o && setLabelsFor(null)}
      />
      <ProductFormDialog open={formOpen} onOpenChange={setFormOpen} product={editing} />
      <AdjustStockDialog
        open={adjustFor !== null}
        onOpenChange={(o) => !o && setAdjustFor(null)}
        productId={adjustFor?.p || undefined}
      />
      <RestockDialog
        open={restockFor !== null}
        onOpenChange={(o) => !o && setRestockFor(null)}
        productId={restockFor?.p || undefined}
      />
    </div>
  );
}
