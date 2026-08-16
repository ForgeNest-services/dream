import { createFileRoute } from "@tanstack/react-router";
import { KhataView } from "@/components/pos/KhataView";

export const Route = createFileRoute("/_app/khata")({
  head: () => ({ meta: [{ title: "Khata — Srota RMS" }] }),
  component: KhataView,
});
