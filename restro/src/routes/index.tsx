import { createFileRoute } from "@tanstack/react-router";
import { PosApp } from "@/components/pos/PosApp";
import { PosProvider } from "@/lib/pos/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Zestro — Restaurant POS" },
      {
        name: "description",
        content:
          "Zestro: multi-branch restaurant POS with floor tables, menu & variants, manual inventory, kitchen display and sales reports with Bikram Sambat dates.",
      },
      { property: "og:title", content: "Zestro — Restaurant POS" },
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
  return (
    <PosProvider>
      <PosApp />
    </PosProvider>
  );
}
