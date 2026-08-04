import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppLayout } from "@/components/app-layout";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/_app")({
  component: AppShell,
});

function AppShell() {
  const { authed } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authed) navigate({ to: "/" });
  }, [authed, navigate]);

  if (!authed) return null;

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
