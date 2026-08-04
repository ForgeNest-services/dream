import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppLayout } from "@/components/app-layout";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/_app")({
  component: AppShell,
});

function AppShell() {
  const { authed, isBootstrapping } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isBootstrapping && !authed) {
      navigate({ to: "/" });
    }
  }, [authed, isBootstrapping, navigate]);

  if (isBootstrapping || !authed) return null;

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
