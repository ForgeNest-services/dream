import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { LoginScreen } from "@/components/pos/Login";
import { usePos } from "@/lib/pos/store";
import { landingRouteForRole } from "@/lib/pos/nav";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Srota RMS — Restaurant POS" },
      {
        name: "description",
        content:
          "Srota RMS: multi-branch restaurant POS with floor tables, menu & variants, manual inventory, kitchen display and sales reports with Bikram Sambat dates.",
      },
      { property: "og:title", content: "Srota RMS — Restaurant POS" },
      {
        property: "og:description",
        content:
          "Multi-branch restaurant POS with floor tables, menu & variants, manual inventory, kitchen display and sales reports.",
      },
      { property: "og:image", content: "/logo.png" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "/logo.png" },
    ],
  }),
  component: Index,
});

function Index() {
  const { session, isBootstrapping } = usePos();
  const router = useRouter();

  useEffect(() => {
    if (isBootstrapping || !session) return;
    router.navigate({ to: landingRouteForRole(session.role) });
  }, [session, isBootstrapping, router]);

  if (isBootstrapping || session) return null;
  return <LoginScreen />;
}
