import { createFileRoute } from "@tanstack/react-router";
import { DailySalesView } from "@/components/pos/DailySalesView";

export const Route = createFileRoute("/_app/daily")({
  head: () => ({ meta: [{ title: "Daily Sales — Srota RMS" }] }),
  component: DailySalesView,
});
