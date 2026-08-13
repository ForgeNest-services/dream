import { createFileRoute } from "@tanstack/react-router";
import { SettingsView } from "@/components/pos/SettingsView";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — Srota RMS" }] }),
  component: SettingsView,
});
