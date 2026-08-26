import { TablePagination } from "@/components/common/table-pagination";
import { ExportButtons } from "@/components/common/export-buttons";
import { EmptyState, Money, PageHeader, Qty } from "@/components/common/primitives";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/context/app-store";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useStockSummaryReport } from "@/hooks/useReports";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Search } from "lucide-react";

const num = (v: number | string): number => Number(v);

/** Shared presentational body for /reports/stock and /reports/low-stock —
 *  same data source and columns, the low-stock page just fixes
 *  lowStockOnly=true. Each route file owns its own URL search state
 *  (TanStack's Route.useSearch/useNavigate are strongly typed per-route, so
 *  they're read by the caller and passed in as plain values/callbacks
 *  rather than threading the Route object itself through here). */
export function StockReportPage({
  lowStockOnly,
  title,
  exportPath,
  q,
  categoryId,
  page,
  perPage,
  onSearchChange,
}: {
  lowStockOnly: boolean;
  title: string;
  exportPath: string;
  q: string;
  categoryId: string;
  page: number;
  perPage: number;
  onSearchChange: (patch: { q?: string; categoryId?: string; page?: number; perPage?: number }) => void;
}) {
  const app = useApp();
  const debouncedQ = useDebouncedValue(q, 300);

  const { rows, meta, isLoading } = useStockSummaryReport({
    branch_id: app.branchId === "all" ? undefined : app.branchId,
    category_id: categoryId === "all" ? undefined : categoryId,
    q: debouncedQ || undefined,
    low_stock_only: lowStockOnly,
    page,
    per_page: perPage,
  });

  const totalCostValue = rows.reduce((s, r) => s + num(r.cost_value), 0);
  const totalRetailValue = rows.reduce((s, r) => s + num(r.retail_value), 0);
  const itemNoun = lowStockOnly ? "low-stock item" : "item";

  const exportParams = {
    branch_id: app.branchId === "all" ? undefined : app.branchId,
    category_id: categoryId === "all" ? undefined : categoryId,
    q: debouncedQ || undefined,
    low_stock_only: lowStockOnly ? "true" : undefined,
  };

  return (
    <div className="mx-auto max-w-[1760px] px-4 py-6">
      <div className="mb-2">
        <Link
          to="/reports"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to reports
        </Link>
      </div>
      <PageHeader
        title={title}
        subtitle={`${meta?.total ?? rows.length} ${itemNoun}${(meta?.total ?? rows.length) === 1 ? "" : "s"} — Cost value ${totalCostValue.toFixed(0)}, Retail value ${totalRetailValue.toFixed(0)}`}
        actions={<ExportButtons path={exportPath} params={exportParams} />}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => onSearchChange({ q: e.target.value, page: 1 })}
            placeholder="Search product or variant…"
            className="pl-8"
          />
        </div>
        <Select value={categoryId} onValueChange={(v) => onSearchChange({ categoryId: v, page: 1 })}>
          <SelectTrigger className="w-56">
            <SelectValue />
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
      </div>

      {!isLoading && rows.length === 0 ? (
        <EmptyState
          title={lowStockOnly ? "Nothing is low on stock" : "No stock to report"}
          description="Adjust the filters or category."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 text-left font-medium">Product</th>
                  <th className="px-3 py-2.5 text-left font-medium">Variant</th>
                  <th className="px-3 py-2.5 text-left font-medium">Category</th>
                  <th className="px-3 py-2.5 text-right font-medium">Stock</th>
                  <th className="px-3 py-2.5 text-right font-medium">Reorder At</th>
                  <th className="px-3 py-2.5 text-right font-medium">Cost Price</th>
                  <th className="px-3 py-2.5 text-right font-medium">Selling Price</th>
                  <th className="px-3 py-2.5 text-right font-medium">Cost Value</th>
                  <th className="px-3 py-2.5 text-right font-medium">Retail Value</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.variant_id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2.5">{r.product_name}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.variant_name}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.category_path}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Qty value={num(r.stock_qty)} unit={r.unit_symbol} />
                    </td>
                    <td className="num px-3 py-2.5 text-right">{r.low_stock_at}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Money value={num(r.cost_price)} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Money value={num(r.selling_price)} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Money value={num(r.cost_value)} />
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium">
                      <Money value={num(r.retail_value)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={meta?.page ?? page}
            perPage={meta?.per_page ?? perPage}
            totalItems={meta?.total ?? rows.length}
            totalPages={meta?.total_pages ?? 1}
            onPageChange={(p) => onSearchChange({ page: p })}
            onPerPageChange={(pp) => onSearchChange({ perPage: pp, page: 1 })}
          />
        </div>
      )}
    </div>
  );
}
