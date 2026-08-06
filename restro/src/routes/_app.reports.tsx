import { createFileRoute } from "@tanstack/react-router";
import { ReportsView } from "@/components/pos/ReportsView";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({ meta: [{ title: "Reports — Zestro" }] }),
  component: ReportsView,
});
