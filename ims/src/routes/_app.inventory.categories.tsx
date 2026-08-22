import { EmptyState, PageHeader } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/context/app-store";
import type { Category } from "@/data/types";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/inventory/categories")({
  head: () => ({
    meta: [
      { title: "Categories & Brands — SROTA IMS" },
      {
        name: "description",
        content:
          "Unlimited category tree with sub-categories, product counts and a separate brand list.",
      },
      { property: "og:title", content: "Categories & Brands — SROTA IMS" },
      {
        property: "og:description",
        content: "Organise the catalogue with a nested category tree and brands.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const app = useApp();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [dialog, setDialog] = useState<
    { mode: "add"; parentId: string | null } | { mode: "rename"; cat: Category } | null
  >(null);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");

  const canEdit = app.can("product.edit");

  const countIn = (id: string): number => {
    const kids = app.categories.filter((c) => c.parentId === id);
    return (
      app.products.filter((p) => p.categoryId === id).length +
      kids.reduce((s, k) => s + countIn(k.id), 0)
    );
  };

  const submit = async () => {
    if (!name.trim() || !dialog) return;
    const res =
      dialog.mode === "add"
        ? await app.addCategory(name.trim(), dialog.parentId)
        : await app.renameCategory(dialog.cat.id, name.trim());
    if (!res.ok) {
      toast.error(res.error ?? "Something went wrong");
      return;
    }
    toast.success(dialog.mode === "add" ? "Category added" : "Category renamed");
    setDialog(null);
    setName("");
  };

  const Node = ({ cat, depth }: { cat: Category; depth: number }) => {
    const kids = app.childCategories(cat.id);
    const isOpen = open[cat.id] ?? depth < 1;
    return (
      <div>
        <div
          className="group flex items-center gap-1 border-b py-2 pr-2 hover:bg-muted/30"
          style={{ paddingLeft: depth * 20 + 8 }}
        >
          {kids.length ? (
            <button
              type="button"
              aria-label={isOpen ? "Collapse" : "Expand"}
              onClick={() => setOpen((o) => ({ ...o, [cat.id]: !isOpen }))}
              className="rounded p-1 text-muted-foreground hover:bg-muted"
            >
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span className="w-6" />
          )}
          <span className="text-sm font-medium">{cat.name}</span>
          <span className="num ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {countIn(cat.id)}
          </span>
          {canEdit ? (
            <div className="ml-auto flex opacity-0 transition group-hover:opacity-100">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Add sub-category"
                onClick={() => {
                  setName("");
                  setDialog({ mode: "add", parentId: cat.id });
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Rename"
                onClick={() => {
                  setName(cat.name);
                  setDialog({ mode: "rename", cat });
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete"
                onClick={async () => {
                  const res = await app.deleteCategory(cat.id);
                  if (!res.ok) {
                    toast.error(res.error ?? "Failed to delete category");
                    return;
                  }
                  toast.success("Category removed");
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ) : null}
        </div>
        {isOpen
          ? kids.map((k) => <Node key={k.id} cat={k} depth={depth + 1} />)
          : null}
      </div>
    );
  };

  const roots = app.childCategories(null);

  return (
    <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
      <div>
        <PageHeader
          title="Categories"
          subtitle="Unlimited nesting — a category can hold sub-categories and products"
          actions={
            canEdit ? (
              <Button
                size="sm"
                onClick={() => {
                  setName("");
                  setDialog({ mode: "add", parentId: null });
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Root category
              </Button>
            ) : null
          }
        />
        {roots.length === 0 ? (
          <EmptyState title="No categories yet" description="Create your first root category." />
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card">
            {roots.map((c) => (
              <Node key={c.id} cat={c} depth={0} />
            ))}
          </div>
        )}
      </div>

      <div>
        <PageHeader title="Brands" subtitle="Brands are separate from categories" />
        <div className="rounded-lg border bg-card">
          <ul className="divide-y">
            {app.brands.map((b) => (
              <li key={b.id} className="flex items-center gap-2 px-3 py-2.5 text-sm">
                <Tag className="h-4 w-4 text-muted-foreground" />
                {b.name}
                <span className="num ml-auto text-xs text-muted-foreground">
                  {app.products.filter((p) => p.brandId === b.id).length}
                </span>
              </li>
            ))}
          </ul>
          {canEdit ? (
            <div className="flex gap-2 border-t p-3">
              <Input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="New brand name"
              />
              <Button
                onClick={async () => {
                  if (!brand.trim()) return;
                  const res = await app.addBrand(brand.trim());
                  if (!res.ok) {
                    toast.error(res.error ?? "Failed to add brand");
                    return;
                  }
                  setBrand("");
                  toast.success("Brand added");
                }}
              >
                Add
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === "rename" ? "Rename category" : "New category"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            {dialog?.mode === "add" && dialog.parentId ? (
              <p className="text-xs text-muted-foreground">
                Under {app.categoryPath(dialog.parentId)}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button onClick={submit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
