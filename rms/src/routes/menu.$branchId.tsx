import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { publicMenuApi, type PublicMenuDto } from "@/lib/public-menu-api";
import { NPR } from "@/lib/pos/data";

export const Route = createFileRoute("/menu/$branchId")({
  head: () => ({
    meta: [
      { title: "Menu — Srota RMS" },
      {
        name: "description",
        content:
          "Browse the full food and drinks menu with live prices for this Srota RMS branch.",
      },
      { property: "og:title", content: "Menu — Srota RMS" },
      {
        property: "og:description",
        content:
          "Browse the full food and drinks menu with live prices for this Srota RMS branch.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicMenu,
});

const asN = (v: string | null | undefined) => (v == null ? 0 : Number(v));

function PublicMenu() {
  const { branchId } = Route.useParams();
  const [data, setData] = useState<PublicMenuDto | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "not-found" | "error">(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    publicMenuApi
      .get(branchId)
      .then((r) => {
        if (cancelled) return;
        if (r.success && r.data) {
          setData(r.data);
          setStatus("ok");
        } else {
          setStatus("error");
        }
      })
      .catch((err: { status?: number; code?: string }) => {
        if (cancelled) return;
        // Backend returns 404 with code "BRANCH_NOT_FOUND" for either a
        // typo'd URL or a branch that was soft-deleted.
        setStatus(err.status === 404 ? "not-found" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [branchId]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-navy px-4 py-8 text-center text-navy-foreground">
          <div className="mx-auto h-6 w-40 animate-pulse rounded bg-navy-soft/60" />
          <div className="mx-auto mt-2 h-4 w-56 animate-pulse rounded bg-navy-soft/60" />
        </header>
        <main className="mx-auto max-w-2xl px-4 py-6">
          <p className="text-center text-sm text-muted-foreground">Loading menu…</p>
        </main>
      </div>
    );
  }

  if (status === "not-found") {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-navy px-4 py-8 text-center text-navy-foreground">
          <h1 className="font-display text-2xl">Menu not found</h1>
          <p className="mt-1 text-sm opacity-70">
            This QR link doesn't match an active branch.
          </p>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-6">
          <p className="text-center text-sm text-muted-foreground">
            Please ask staff for a fresh QR — the branch may have been renamed
            or deactivated.
          </p>
        </main>
      </div>
    );
  }

  if (status === "error" || !data) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-navy px-4 py-8 text-center text-navy-foreground">
          <h1 className="font-display text-2xl">Menu unavailable</h1>
          <p className="mt-1 text-sm opacity-70">
            We couldn't load the menu right now.
          </p>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-6">
          <button
            onClick={() => location.reload()}
            className="mx-auto block rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Retry
          </button>
        </main>
      </div>
    );
  }

  const { branch, categories } = data;
  // Address line: combine street + city if both present, else fall back to
  // whichever is set. Empty when the branch record has no location info.
  const addressLine = [branch.address, branch.city].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-navy px-4 py-8 text-center text-navy-foreground">
        <h1 className="font-display text-2xl">Srota RMS</h1>
        <p className="mt-1 text-sm opacity-70">
          {branch.name}
          {addressLine && <> · {addressLine}</>}
        </p>
        <p className="mt-3 text-xs uppercase tracking-widest text-amber">Menu</p>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        {categories.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            No items on the menu yet. Ask staff for details.
          </p>
        )}

        {categories.map((c) => (
          <section key={c.id} className="mb-8">
            <h2 className="font-display text-xl text-primary">{c.name}</h2>
            <ul className="mt-3 space-y-3">
              {c.items.map((m) => (
                <li key={m.id} className="border-b border-border pb-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span
                      className={`min-w-0 ${
                        m.sold_out ? "text-muted-foreground line-through" : ""
                      }`}
                    >
                      {m.name}
                    </span>
                    {!m.has_variants && (
                      <span className="shrink-0 text-sm">
                        {NPR(asN(m.price))}
                      </span>
                    )}
                  </div>
                  {m.has_variants && (
                    <ul className="mt-1 space-y-0.5">
                      {m.variants.map((v) => (
                        <li
                          key={v.name}
                          className="flex justify-between gap-3 text-sm text-muted-foreground"
                        >
                          <span className="min-w-0 truncate">{v.name}</span>
                          <span className="shrink-0">{NPR(asN(v.price))}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {m.sold_out && (
                    <p className="text-xs text-danger">Sold out today</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="pb-10 text-center text-xs text-muted-foreground">
          Prices in NPR, inclusive of applicable taxes. View only — please
          order with our staff.
        </p>
      </main>
    </div>
  );
}
