import { createFileRoute } from "@tanstack/react-router";
import { DeliveryView } from "@/components/pos/DeliveryView";

export const Route = createFileRoute("/_app/delivery")({
  head: () => ({ meta: [{ title: "Delivery — Zestro" }] }),
  component: DeliveryView,
});
