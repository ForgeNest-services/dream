import { SubTabs } from "@/components/layout/top-bar";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/inventory")({
  component: InventoryLayout,
});

function InventoryLayout() {
  return (
    <div>
      <SubTabs
        items={[
          { label: "Products", to: "/inventory/products" },
          { label: "Categories", to: "/inventory/categories" },
          { label: "Media Center", to: "/inventory/media" },
          { label: "Stock Movements", to: "/inventory/movements" },
        ]}
      />
      <div className="mx-auto max-w-[1760px] px-4 py-6">
        <Outlet />
      </div>
    </div>
  );
}
