import { createFileRoute } from "@tanstack/react-router";
import { BRANCHES, CATEGORIES, MENU_ITEMS, NPR } from "@/lib/pos/data";

export const Route = createFileRoute("/menu/$branchId")({
  head: () => ({
    meta: [
      { title: "Menu — Restro POS" },
      { name: "description", content: "Browse the full food and drinks menu with live prices for this Restro POS branch." },
      { property: "og:title", content: "Menu — Restro POS" },
      { property: "og:description", content: "Browse the full food and drinks menu with live prices for this Restro POS branch." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicMenu,
});

function PublicMenu() {
  const { branchId } = Route.useParams();
  const branch = BRANCHES.find((b) => b.id === branchId) ?? BRANCHES[0]!;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-navy px-4 py-8 text-center text-navy-foreground">
        <h1 className="font-display text-2xl">Restro POS</h1>
        <p className="mt-1 text-sm opacity-70">{branch.name} · {branch.address}</p>
        <p className="mt-3 text-xs uppercase tracking-widest text-amber">Menu</p>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        {CATEGORIES.map((c) => {
          const items = MENU_ITEMS.filter((m) => m.categoryId === c.id);
          if (!items.length) return null;
          return (
            <section key={c.id} className="mb-8">
              <h2 className="font-display text-xl text-primary">{c.name}</h2>
              <ul className="mt-3 space-y-3">
                {items.map((m) => (
                  <li key={m.id} className="border-b border-border pb-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className={`min-w-0 ${m.soldOut ? "text-muted-foreground line-through" : ""}`}>
                        {m.name}
                      </span>
                      {!m.hasVariants && <span className="shrink-0 text-sm">{NPR(m.price ?? 0)}</span>}
                    </div>
                    {m.hasVariants && (
                      <ul className="mt-1 space-y-0.5">
                        {m.variants.map((v) => (
                          <li key={v.id} className="flex justify-between gap-3 text-sm text-muted-foreground">
                            <span className="min-w-0 truncate">{v.name}</span>
                            <span className="shrink-0">{NPR(v.price)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {m.soldOut && <p className="text-xs text-danger">Sold out today</p>}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        <p className="pb-10 text-center text-xs text-muted-foreground">
          Prices in NPR, inclusive of applicable taxes. View only — please order with our staff.
        </p>
      </main>
    </div>
  );
}
