import { createFileRoute, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { PosHeader } from "@/components/pos/Header";
import { PosNav } from "@/components/pos/PosNav";
import { usePos } from "@/lib/pos/store";
import { landingRouteForRole, roleShowsNav } from "@/lib/pos/nav";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, isBootstrapping } = usePos();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (isBootstrapping) return;
    if (!session) {
      router.navigate({ to: "/" });
      return;
    }
    // Chef/waiter are locked to their role's view. If they somehow land on a
    // different authed route, redirect them back to their landing view.
    if (!roleShowsNav(session.role)) {
      const landing = landingRouteForRole(session.role);
      if (pathname !== landing) router.navigate({ to: landing });
    }
  }, [isBootstrapping, session, pathname, router]);

  if (isBootstrapping || !session) return null;

  return (
    <div className="min-h-screen bg-background">
      <PosHeader />
      {roleShowsNav(session.role) && <PosNav />}
      <main className="p-3 sm:p-5">
        <Outlet />
      </main>
    </div>
  );
}
