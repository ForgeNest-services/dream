import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/parties/")({
  beforeLoad: () => {
    throw redirect({ to: "/parties/customers" });
  },
});
