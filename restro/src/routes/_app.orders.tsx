import { createFileRoute } from "@tanstack/react-router";
import { OrdersView } from "@/components/pos/OrdersView";
import { usePos } from "@/lib/pos/store";
import { roleShowsNav } from "@/lib/pos/nav";

export const Route = createFileRoute("/_app/orders")({
  head: () => ({ meta: [{ title: "Orders — Zestro" }] }),
  component: OrdersRoute,
});

function OrdersRoute() {
  const { session } = usePos();
  // Managers/owners get the extra controls; waiters get the pure order screen.
  const showControls = session ? roleShowsNav(session.role) : false;
  return <OrdersView showControls={showControls} />;
}
