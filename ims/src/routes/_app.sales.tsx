import { SubTabs } from "@/components/layout/top-bar";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/sales")({
  component: SalesLayout,
});

function SalesLayout() {
  return (
    <div>
      <SubTabs
        items={[
          { label: "Point of Sale", to: "/sales/pos" },
          { label: "Invoices", to: "/sales/invoices" },
          { label: "Quotations", to: "/sales/quotations" },
        ]}
      />
      <div className="mx-auto max-w-[1760px] px-4 py-6">
        <Outlet />
      </div>
    </div>
  );
}
