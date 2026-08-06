import { createFileRoute } from "@tanstack/react-router";
import { KitchenView } from "@/components/pos/KitchenView";

export const Route = createFileRoute("/_app/kitchen")({
  head: () => ({ meta: [{ title: "Kitchen Display — Zestro" }] }),
  component: KitchenView,
});
