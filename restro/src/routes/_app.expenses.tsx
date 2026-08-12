import { createFileRoute } from "@tanstack/react-router";
import { ExpensesView } from "@/components/pos/ExpensesView";

export const Route = createFileRoute("/_app/expenses")({
  head: () => ({ meta: [{ title: "Expenses — Srota RMS" }] }),
  component: ExpensesView,
});
