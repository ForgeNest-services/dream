import { useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import placeholder from "@/assets/menu-placeholder.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NPR, type MenuItem, type Variant } from "@/lib/pos/data";
import { usePos } from "@/lib/pos/store";

const uid = () => Math.random().toString(36).slice(2, 10);

function emptyItem(categoryId: string): MenuItem {
  return {
    id: uid(),
    name: "",
    categoryId,
    hasVariants: false,
    price: 0,
    variants: [],
    soldOut: false,
  };
}

export function MenuView() {
  const {
    categories,
    addCategory,
    renameCategory,
    deleteCategory,
    menu,
    saveMenuItem,
    deleteMenuItem,
    toggleSoldOut,
  } = usePos();
  const [activeCat, setActiveCat] = useState(categories[0]?.id ?? "");
  const [newCat, setNewCat] = useState("");
  const [draft, setDraft] = useState<MenuItem | null>(null);

  const items = menu.filter((m) => m.categoryId === activeCat);

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="pos-card h-fit p-4">
        <h2 className="font-display text-lg">Categories</h2>
        <ul className="mt-3 space-y-2">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-1">
              <button
                onClick={() => setActiveCat(c.id)}
                className={`min-h-11 flex-1 rounded-xl px-3 text-left text-sm font-medium transition-colors ${
                  activeCat === c.id
                    ? "bg-navy text-navy-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-accent"
                }`}
              >
                {c.name}
              </button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Rename category"
                className="size-9 shrink-0"
                onClick={() => {
                  const name = window.prompt("Rename category", c.name);
                  if (name) renameCategory(c.id, name);
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete category"
                className="size-9 shrink-0 text-danger"
                onClick={() => deleteCategory(c.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex gap-2">
          <Input
            className="h-11"
            placeholder="New category"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
          />
          <Button
            size="icon"
            className="size-11 shrink-0"
            aria-label="Add category"
            onClick={() => {
              if (newCat.trim()) addCategory(newCat.trim());
              setNewCat("");
            }}
          >
            <Plus className="size-5" />
          </Button>
        </div>
      </aside>

      <section className="space-y-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 className="truncate font-display text-xl">
            {categories.find((c) => c.id === activeCat)?.name ?? "Menu"}
          </h2>
          <Button size="lg" className="h-12 shrink-0" onClick={() => setDraft(emptyItem(activeCat))}>
            <Plus className="size-5" />
            Add Item
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article key={item.id} className="pos-card overflow-hidden">
              <img
                src={item.image || placeholder}
                alt={item.name}
                loading="lazy"
                width={512}
                height={512}
                className="h-36 w-full object-cover"
              />
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-lg leading-none">{item.name}</h3>
                    <p className="mt-1 text-sm font-semibold text-primary">
                      {item.hasVariants
                        ? `${item.variants.length} variants · from ${NPR(
                            Math.min(...item.variants.map((v) => v.price), 0) || 0,
                          )}`
                        : NPR(item.price ?? 0)}
                    </p>
                  </div>
                  {item.soldOut && <Badge className="shrink-0 bg-danger text-danger-foreground">Sold Out</Badge>}
                </div>

                {item.hasVariants && (
                  <div className="flex flex-wrap gap-1.5">
                    {item.variants.map((v) => (
                      <span key={v.id} className="rounded-md bg-secondary px-2 py-1 text-xs font-semibold">
                        {v.name} · {NPR(v.price)}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                  <label className="flex items-center gap-2 text-xs font-medium">
                    <Switch checked={item.soldOut} onCheckedChange={() => toggleSoldOut(item.id)} />
                    Sold Out
                  </label>
                  <div className="flex gap-1">
                    <Button variant="outline" size="icon" className="size-10" aria-label="Edit item" onClick={() => setDraft(item)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-10 text-danger"
                      aria-label="Delete item"
                      onClick={() => deleteMenuItem(item.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          ))}
          {items.length === 0 && (
            <p className="pos-card p-8 text-sm text-muted-foreground sm:col-span-2 xl:col-span-3">
              No items in this category yet.
            </p>
          )}
        </div>
      </section>

      <MenuItemDialog
        draft={draft}
        onClose={() => setDraft(null)}
        onSave={(item) => {
          saveMenuItem(item);
          setDraft(null);
        }}
      />
    </div>
  );
}

function MenuItemDialog({
  draft,
  onClose,
  onSave,
}: {
  draft: MenuItem | null;
  onClose: () => void;
  onSave: (item: MenuItem) => void;
}) {
  const { categories } = usePos();
  const [item, setItem] = useState<MenuItem | null>(draft);

  if (draft && (!item || item.id !== draft.id)) setItem(draft);
  if (!draft || !item) return null;

  const patch = (p: Partial<MenuItem>) => setItem({ ...item, ...p });
  const setVariant = (id: string, p: Partial<Variant>) =>
    patch({ variants: item.variants.map((v) => (v.id === id ? { ...v, ...p } : v)) });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {draft.name ? "Edit menu item" : "Add menu item"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input className="h-12" value={item.name} onChange={(e) => patch({ name: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={item.categoryId} onValueChange={(val) => patch({ categoryId: val })}>
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Image</Label>
            <div className="flex items-center gap-3">
              <img
                src={item.image || placeholder}
                alt=""
                width={64}
                height={64}
                className="size-16 rounded-xl object-cover"
              />
              <Input
                type="file"
                accept="image/*"
                className="h-12"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) patch({ image: URL.createObjectURL(file) });
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">Default placeholder is used when no image is uploaded.</p>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-secondary p-4">
            <div>
              <p className="font-medium">Has Variants</p>
              <p className="text-xs text-muted-foreground">e.g. Veg / Chicken / Buff / Pork</p>
            </div>
            <Switch
              checked={item.hasVariants}
              onCheckedChange={(checked) =>
                patch({
                  hasVariants: checked,
                  variants:
                    checked && item.variants.length === 0
                      ? [{ id: uid(), name: "Veg", price: 0 }]
                      : item.variants,
                })
              }
            />
          </div>

          {!item.hasVariants ? (
            <div className="space-y-2">
              <Label>Price (NPR)</Label>
              <Input
                type="number"
                className="h-12"
                value={item.price ?? 0}
                onChange={(e) => patch({ price: Number(e.target.value) })}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Variants</Label>
              {item.variants.map((v) => (
                <div key={v.id} className="flex gap-2">
                  <Input
                    className="h-12"
                    placeholder="Variant name"
                    value={v.name}
                    onChange={(e) => setVariant(v.id, { name: e.target.value })}
                  />
                  <Input
                    type="number"
                    className="h-12 w-32"
                    placeholder="NPR"
                    value={v.price}
                    onChange={(e) => setVariant(v.id, { price: Number(e.target.value) })}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-12 shrink-0 text-danger"
                    aria-label="Remove variant"
                    onClick={() => patch({ variants: item.variants.filter((x) => x.id !== v.id) })}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                className="h-11 w-full"
                onClick={() => patch({ variants: [...item.variants, { id: uid(), name: "", price: 0 }] })}
              >
                <Plus className="size-4" />
                Add variant
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl bg-secondary p-4">
            <div>
              <p className="font-medium">Sold Out</p>
              <p className="text-xs text-muted-foreground">Manual flag, independent of Inventory</p>
            </div>
            <Switch checked={item.soldOut} onCheckedChange={(checked) => patch({ soldOut: checked })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="h-12" onClick={onClose}>
            Cancel
          </Button>
          <Button className="h-12" disabled={!item.name} onClick={() => onSave(item)}>
            Save item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
