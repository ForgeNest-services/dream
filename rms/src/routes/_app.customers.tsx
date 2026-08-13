import { createFileRoute } from "@tanstack/react-router";
import { CustomersView } from "@/components/pos/CustomersView";

export const Route = createFileRoute("/_app/customers")({
  head: () => ({ meta: [{ title: "Customers — Srota RMS" }] }),
  component: CustomersView,
});
