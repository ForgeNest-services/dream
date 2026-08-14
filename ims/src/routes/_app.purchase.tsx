import { SubTabs } from "@/components/layout/top-bar";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/purchase")({
  component: PurchaseLayout,
});

function PurchaseLayout() {
  return (
    <div>
      <SubTabs
        items={[
          { label: "New Purchase", to: "/purchase/new" },
          { label: "Purchase Bills", to: "/purchase/bills" },
        ]}
      />
      <div className="mx-auto max-w-[1760px] px-4 py-6">
        <Outlet />
      </div>
    </div>
  );
}
