import { AlertTriangle, Receipt, TrendingUp, Utensils } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { NPR, SALES_TREND, TOP_ITEMS } from "@/lib/pos/data";
import { usePos } from "@/lib/pos/store";

function Stat({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
}) {
  return (
    <div className="pos-card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
          <Icon className="size-5" />
        </span>
      </div>
      <p className="mt-3 font-display text-2xl leading-none">{value}</p>
      <p className="mt-2 text-xs font-semibold text-muted-foreground">{sub}</p>
    </div>
  );
}

export function DashboardView() {
  const { inventory, tables } = usePos();
  const lowStock = inventory.filter((i) => i.stock <= i.threshold);
  const occupied = tables.filter((t) => t.status === "occupied").length;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Today's Sales" value={NPR(91200)} sub="+18% vs yesterday" icon={TrendingUp} />
        <Stat label="Orders" value="147" sub="32 running, 115 closed" icon={Receipt} />
        <Stat label="Tables Occupied" value={`${occupied}/${tables.length}`} sub="Live floor status" icon={Utensils} />
        <Stat label="Low Stock Alerts" value={String(lowStock.length)} sub="Needs restocking" icon={AlertTriangle} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="pos-card p-5 xl:col-span-2">
          <h2 className="font-display text-xl">Sales this week</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={SALES_TREND} margin={{ left: -12, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={64} />
                <Tooltip
                  formatter={(val: number) => NPR(val)}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--color-border)",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="var(--color-primary)"
                  strokeWidth={3}
                  fill="url(#salesFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="pos-card p-5">
          <h2 className="font-display text-xl">Top selling items</h2>
          <ul className="mt-4 space-y-3">
            {TOP_ITEMS.map((item, i) => (
              <li key={item.name} className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-navy font-display text-lg text-navy-foreground">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.qty} sold</p>
                </div>
                <span className="shrink-0 text-sm font-medium text-primary">{NPR(item.revenue)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="pos-card p-5">
        <h2 className="font-display text-xl">Low stock alerts</h2>
        {lowStock.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Everything is well stocked.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lowStock.map((i) => (
              <div
                key={i.id}
                className={`flex items-center justify-between gap-3 rounded-xl border-2 p-4 ${
                  i.stock === 0 ? "border-danger bg-danger/10" : "border-warning bg-warning/10"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{i.name}</p>
                  <p className="text-xs text-muted-foreground">Threshold {i.threshold} {i.unit}</p>
                </div>
                <span className="shrink-0 font-display text-lg">
                  {i.stock} {i.unit}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
