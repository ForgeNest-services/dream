import { createFileRoute } from "@tanstack/react-router";
import { EmployeesView } from "@/components/pos/EmployeesView";

export const Route = createFileRoute("/_app/employees")({
  head: () => ({ meta: [{ title: "Employees — Zestro" }] }),
  component: EmployeesView,
});
