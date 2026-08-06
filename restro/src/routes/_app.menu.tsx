import { createFileRoute } from "@tanstack/react-router";
import { MenuView } from "@/components/pos/MenuView";

export const Route = createFileRoute("/_app/menu")({
  head: () => ({ meta: [{ title: "Menu — Zestro" }] }),
  component: MenuView,
});
