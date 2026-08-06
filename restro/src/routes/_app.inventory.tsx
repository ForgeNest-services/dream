import { createFileRoute } from "@tanstack/react-router";
import { InventoryView } from "@/components/pos/InventoryView";

export const Route = createFileRoute("/_app/inventory")({
  head: () => ({ meta: [{ title: "Inventory — Zestro" }] }),
  component: InventoryView,
});
