import { createFileRoute } from "@tanstack/react-router";
import { PosApp } from "@/components/pos/PosApp";
import { PosProvider } from "@/lib/pos/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Restro POS — Restaurant Point of Sale Dashboard" },
      {
        name: "description",
        content:
          "Multi-branch restaurant POS: floor tables, menu & variants, manual inventory, kitchen display and sales reports with Bikram Sambat dates.",
      },
      { property: "og:title", content: "Restro POS — Restaurant Point of Sale Dashboard" },
      {
        property: "og:description",
        content:
          "Multi-branch restaurant POS: floor tables, menu & variants, manual inventory, kitchen display and sales reports with Bikram Sambat dates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
