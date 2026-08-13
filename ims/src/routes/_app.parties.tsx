import { SubTabs } from "@/components/layout/top-bar";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/parties")({
  component: PartiesLayout,
});

function PartiesLayout() {
  return (
    <div>
      <SubTabs
        items={[
          { label: "Customers", to: "/parties/customers" },
          { label: "Suppliers", to: "/parties/suppliers" },
        ]}
      />
      <div className="mx-auto max-w-[1760px] px-4 py-6">
        <Outlet />
      </div>
    </div>
  );
}
