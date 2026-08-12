import { createFileRoute } from "@tanstack/react-router";
import { DashboardView } from "@/components/pos/DashboardView";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Srota RMS" }] }),
  component: DashboardView,
});
