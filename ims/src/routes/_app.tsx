import { CommandPalette } from "@/components/layout/command-palette";
import { TopBar } from "@/components/layout/top-bar";
import { useApp } from "@/context/app-store";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const app = useApp();
  const navigate = useNavigate();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setChecked(true), 60);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (checked && !app.currentUser) void navigate({ to: "/", replace: true });
  }, [checked, app.currentUser, navigate]);

  if (!app.currentUser) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <TopBar onOpenCommand={() => setCmdOpen(true)} />
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
      <Outlet />
    </div>
  );
}
