import { EmptyState, Money, PageHeader, Qty, StatusPill } from "@/components/common/primitives";
import { TablePagination } from "@/components/common/table-pagination";
import { MediaThumb } from "@/components/inventory/media-picker";
import { AdjustStockDialog, RestockDialog } from "@/components/inventory/stock-dialogs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { normalizeTableSearch } from "@/hooks/useTableQuery";
import { useProducts } from "@/hooks/useProducts";
import type { Product } from "@/data/types";
import { productsApi, type ProductDto } from "@/lib/products-api";
import { downloadCsv } from "@/lib/csv";
import { priceWithVat } from "@/lib/format";
import { createFileRoute, Link } from "@tanstack/react-router";
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
  Trash2,
} from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { toast } from "sonner";

function dtoToProduct(p: ProductDto): Product {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    categoryId: p.category_id,
    brandId: p.brand_id ?? undefined,
    mediaId: p.media_id ?? undefined,
    description: p.description ?? undefined,
    taxable: p.taxable ?? undefined,
    // Backend Decimal fields serialize as JSON strings — coerce or
    // arithmetic on this silently does string concatenation.
    taxRate: p.tax_rate == null ? undefined : Number(p.tax_rate),
    createdAt: p.created_at,
  };
}

interface ProductsSearch {
  q: string;
  categoryId: string;
  brandId: string;
  stockFilter: string;
  page: number;
  perPage: number;
}

export const Route = createFileRoute("/_app/inventory/products/")({
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
  validateSearch: (search: Record<string, unknown>): ProductsSearch => {
    const normalized = normalizeTableSearch({
      page: Number(search.page) || 1,
      perPage: Number(search.perPage) || 25,
    });
    return {
      q: typeof search.q === "string" ? search.q : "",
      categoryId: typeof search.categoryId === "string" ? search.categoryId : "all",
      brandId: typeof search.brandId === "string" ? search.brandId : "all",
      stockFilter: typeof search.stockFilter === "string" ? search.stockFilter : "all",
      page: normalized.page,
      perPage: normalized.perPage,
    };
  },
  component: ProductsPage,
});

function ProductsPage() {
  const app = useApp();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const setSearch = (patch: Partial<ProductsSearch>) => {
    navigate({ search: (prev) => ({ ...prev, ...patch }) });
  };

  const [barcode, setBarcode] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [labelsFor, setLabelsFor] = useState<string | null>(null);
  const [adjustFor, setAdjustFor] = useState<{ p: string; v: string } | null>(null);
  const [restockFor, setRestockFor] = useState<{ p: string; v: string } | null>(null);
  const [deleteFor, setDeleteFor] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const debouncedQ = useDebouncedValue(search.q, 300);
  const debouncedBarcode = useDebouncedValue(barcode, 300);
  // Barcode filter has no separate backend param — it's just another term
  // that matches the same q search (name/sku/variant name/model_no/barcode).
  const effectiveQ = debouncedBarcode.trim() || debouncedQ;

  const descendantIds = (id: string): string[] => {
    const kids = app.categories.filter((c) => c.parentId === id);
    return [id, ...kids.flatMap((k) => descendantIds(k.id))];
  };
  const categoryIdParam =
    search.categoryId === "all" ? undefined : descendantIds(search.categoryId).join(",");

  const { products, meta, isLoading, refetch } = useProducts({
    q: effectiveQ || undefined,
    category_id: categoryIdParam,
    brand_id: search.brandId === "all" ? undefined : search.brandId,
    stock_status: search.stockFilter === "all" ? "" : (search.stockFilter as "in-stock" | "low" | "out"),
    page: search.page,
    per_page: search.perPage,
  });

  useEffect(() => {
    app.syncProducts(products);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  useEffect(() => {
    if (meta && search.page > meta.total_pages) {
      setSearch({ page: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta?.total_pages]);

  const statusOf = (productId: string) => {
    const vs = app.variantsOf(productId);
    const total = vs.reduce((s, v) => s + app.stockOf(v), 0);
    if (total <= 0) return "out";
    if (vs.some((v) => app.stockOf(v) <= v.lowStockAt)) return "low";
    return "in-stock";
  };

  const EXPIRY_WARN_DAYS = 14;
  const daysUntil = (isoDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(isoDate);
    target.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - today.getTime()) / 86_400_000);
  };
  /** Soonest expiry across a product's variants that still have stock —
   *  an already-sold-out expired variant isn't worth flagging. */
  const soonestExpiry = (productId: string): { days: number; date: string } | null => {
    const vs = app.variantsOf(productId).filter((v) => v.expiryDate && app.stockOf(v) > 0);
    if (vs.length === 0) return null;
    const soonest = vs.reduce((a, b) => (a.expiryDate! < b.expiryDate! ? a : b));
    return { days: daysUntil(soonest.expiryDate!), date: soonest.expiryDate! };
  };

  const rows = products.map(dtoToProduct);

  const [exporting, setExporting] = useState(false);

  // Exports every product matching the current filters, not just the page
  // currently on screen — pages through the backend at MAX_PER_PAGE (100)
  // until meta.total_pages is covered, independent of the on-screen perPage.
  const exportCsv = async () => {
    setExporting(true);
    try {
      const all: ProductDto[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const res = await productsApi.list({
          q: effectiveQ || undefined,
          category_id: categoryIdParam,
          brand_id: search.brandId === "all" ? undefined : search.brandId,
          stock_status: search.stockFilter === "all" ? "" : (search.stockFilter as "in-stock" | "low" | "out"),
          page,
          per_page: 100,
        });
        all.push(...(res.data ?? []));
        totalPages = res.meta?.total_pages ?? 1;
        page += 1;
      } while (page <= totalPages);

      const stockOfDto = (v: ProductDto["variants"][number]) =>
        app.branchId === "all"
          ? v.stock.reduce((s, row) => s + Number(row.qty), 0)
          : Number(v.stock.find((row) => row.branch_id === app.branchId)?.qty ?? 0);

      downloadCsv(
        "products",
        all.flatMap((dto) => {
          const p = dtoToProduct(dto);
          const taxable = app.company.vatRegistered && p.taxable !== false;
          const rate = taxable ? (p.taxRate ?? app.company.vatRate) : 0;
          return dto.variants.map((v) => ({
            product: p.name,
            sku: p.sku,
            category: app.categoryPath(p.categoryId),
            brand: app.brands.find((b) => b.id === p.brandId)?.name ?? "",
            variant: v.name,
            model: v.model_no ?? "",
            barcode: v.barcode ?? "",
            unit: app.unitSymbol(v.unit_id),
            cost: v.cost_price,
            price: priceWithVat(Number(v.selling_price), rate, taxable),
            stock: stockOfDto(v),
          }));
        }),
      );
    } catch {
      toast.error("Failed to export products");
    } finally {
      setExporting(false);
    }
  };

  const canEdit = app.can("product.edit");
  // Backend only allows owner/manager to delete a product — storekeeper can
  // edit but not delete, matching the same restriction server-side.
  const canDelete = canEdit && app.effectiveRole !== "storekeeper";

  return (
    <div>
      <PageHeader
        title="Products & Variants"
        subtitle={`${meta?.total ?? rows.length} products`}
        actions={
          <>
            <Button variant="outline" size="sm" disabled={exporting} onClick={() => void exportCsv()}>
              <Download className="mr-1.5 h-4 w-4" /> {exporting ? "Exporting…" : "CSV"}
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
              <Button asChild size="sm">
                <Link to="/inventory/products/new">
                  <Plus className="mr-1.5 h-4 w-4" /> Add product
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search.q}
            onChange={(e) => setSearch({ q: e.target.value, page: 1 })}
            placeholder="Search name, SKU, model or barcode…"
            className="pl-8"
          />
        </div>
        <div className="relative w-56">
          <BarcodeIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="Scan / filter by barcode"
            className="num pl-8"
            aria-label="Filter by barcode"
          />
        </div>
        <Select
          value={search.categoryId}
          onValueChange={(v) => setSearch({ categoryId: v, page: 1 })}
        >
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
        <Select value={search.brandId} onValueChange={(v) => setSearch({ brandId: v, page: 1 })}>
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
        <Select
          value={search.stockFilter}
          onValueChange={(v) => setSearch({ stockFilter: v, page: 1 })}
        >
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

      {!isLoading && rows.length === 0 ? (
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
                {rows.map((p) => {
                  const vs = app.variantsOf(p.id);
                  // Selling price is stored exclusive of VAT — display the
                  // customer-facing inclusive price everywhere in this list.
                  const productTaxable = app.company.vatRegistered && p.taxable !== false;
                  const productTaxRate = productTaxable
                    ? (p.taxRate ?? app.company.vatRate)
                    : 0;
                  const displayPrice = (v: { sellingPrice: number }) =>
                    priceWithVat(v.sellingPrice, productTaxRate, productTaxable);
                  const prices = vs.map(displayPrice);
                  const min = prices.length ? Math.min(...prices) : 0;
                  const max = prices.length ? Math.max(...prices) : 0;
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
                              <Money value={min} /> – <Money value={max} />
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusPill status={statusOf(p.id)} />
                            {(() => {
                              const exp = soonestExpiry(p.id);
                              if (!exp) return null;
                              if (exp.days < 0) {
                                return (
                                  <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                                    Expired
                                  </span>
                                );
                              }
                              if (exp.days <= EXPIRY_WARN_DAYS) {
                                return (
                                  <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                                    Expires in {exp.days}d
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
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
                              <Button asChild variant="ghost" size="icon" aria-label="Edit product">
                                <Link to="/inventory/products/$productId" params={{ productId: p.id }}>
                                  <Pencil className="h-4 w-4" />
                                </Link>
                              </Button>
                            ) : null}
                            {canDelete ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Delete product"
                                onClick={() => setDeleteFor(p)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
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
                                  <th className="py-1 text-right font-medium">
                                    {productTaxable ? "Selling (inc. VAT)" : "Selling"}
                                  </th>
                                  <th className="py-1 text-right font-medium">Stock</th>
                                  <th className="py-1 text-left font-medium">Expiry</th>
                                </tr>
                              </thead>
                              <tbody>
                                {vs.map((v) => {
                                  const days = v.expiryDate ? daysUntil(v.expiryDate) : null;
                                  return (
                                    <tr key={v.id} className="border-t border-border/60">
                                      <td className="py-1.5">{v.name}</td>
                                      <td className="num py-1.5">{v.modelNo || "—"}</td>
                                      <td className="num py-1.5">{v.barcode || "—"}</td>
                                      <td className="py-1.5">{app.unitSymbol(v.unitId)}</td>
                                      <td className="py-1.5 text-right">
                                        <Money value={v.costPrice} />
                                      </td>
                                      <td className="py-1.5 text-right">
                                        <Money value={displayPrice(v)} />
                                      </td>
                                      <td className="py-1.5 text-right">
                                        <Qty
                                          value={app.stockOf(v)}
                                          unit={app.unitSymbol(v.unitId)}
                                        />
                                      </td>
                                      <td className="num py-1.5">
                                        {v.expiryDate ? (
                                          <span
                                            className={
                                              days !== null && days < 0
                                                ? "text-destructive"
                                                : days !== null && days <= EXPIRY_WARN_DAYS
                                                  ? "text-amber-600 dark:text-amber-400"
                                                  : ""
                                            }
                                          >
                                            {v.expiryDate}
                                          </span>
                                        ) : (
                                          "—"
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
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
          <TablePagination
            page={meta?.page ?? search.page}
            perPage={meta?.per_page ?? search.perPage}
            totalItems={meta?.total ?? rows.length}
            totalPages={meta?.total_pages ?? 1}
            onPageChange={(p) => setSearch({ page: p })}
            onPerPageChange={(pp) => setSearch({ perPage: pp, page: 1 })}
          />
        </div>
      )}

      <BarcodeLabelsDialog
        productId={labelsFor}
        open={labelsFor !== null}
        onOpenChange={(o) => !o && setLabelsFor(null)}
      />
      <AdjustStockDialog
        open={adjustFor !== null}
        onOpenChange={(o) => {
          if (!o) {
            setAdjustFor(null);
            refetch();
          }
        }}
        productId={adjustFor?.p || undefined}
      />
      <RestockDialog
        open={restockFor !== null}
        onOpenChange={(o) => {
          if (!o) {
            setRestockFor(null);
            refetch();
          }
        }}
        productId={restockFor?.p || undefined}
      />

      <AlertDialog open={deleteFor !== null} onOpenChange={(o) => !o && setDeleteFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteFor?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the product from the catalogue. Stock movement history for its
              variants is kept for the audit trail — it isn't erased.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={async (e) => {
                e.preventDefault();
                if (!deleteFor) return;
                setDeleting(true);
                try {
                  const res = await app.deleteProduct(deleteFor.id);
                  if (!res.ok) {
                    toast.error(res.error ?? "Failed to delete product");
                    return;
                  }
                  toast.success("Product deleted");
                  setDeleteFor(null);
                  refetch();
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
