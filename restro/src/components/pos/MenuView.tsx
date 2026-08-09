import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NPR, type MenuItem, type Variant } from "@/lib/pos/data";
import { usePos } from "@/lib/pos/store";
import { uploadsApi } from "@/lib/uploads-api";
import { ApiError } from "@/lib/api-client";
import { toast } from "sonner";

const uid = () => Math.random().toString(36).slice(2, 10);

// Frontend-only pseudo-category: "All" shows every item across every real
// category. Never sent to the backend — used as a sentinel value for the
// activeCat state only.
const ALL_CATEGORY = "__all__";

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

function lowestVariantPrice(variants: Variant[]): number {
  if (variants.length === 0) return 0;
  return Math.min(...variants.map((v) => v.price));
}

function ConfirmDeleteDialog({
  open,
  title,
  description,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-danger text-danger-foreground hover:bg-danger/90"
            onClick={onConfirm}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
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
  const [activeCat, setActiveCat] = useState<string>(ALL_CATEGORY);
  const [newCat, setNewCat] = useState("");
  const [draft, setDraft] = useState<MenuItem | null>(null);
  const [catToDelete, setCatToDelete] = useState<{ id: string; name: string } | null>(null);
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);

  const isAll = activeCat === ALL_CATEGORY;
  const items = isAll ? menu : menu.filter((m) => m.categoryId === activeCat);
  const activeCategoryName = isAll
    ? "All items"
    : (categories.find((c) => c.id === activeCat)?.name ?? "Menu");
  // "All" can't hold new items — default new-item creation to the first real
  // category. If there are no real categories yet, the dialog will surface it.
  const addItemTargetCategory = isAll ? (categories[0]?.id ?? "") : activeCat;

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="pos-card h-fit p-4">
        <h2 className="font-display text-lg">Categories</h2>
        <ul className="mt-3 space-y-2">
          <li>
            <button
              onClick={() => setActiveCat(ALL_CATEGORY)}
              className={`min-h-11 w-full rounded-xl px-3 text-left text-sm font-medium transition-colors ${
                isAll
                  ? "bg-navy text-navy-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              All items
              <span className="ml-1.5 text-xs opacity-70">({menu.length})</span>
            </button>
          </li>
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
                onClick={() => setCatToDelete({ id: c.id, name: c.name })}
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
          <h2 className="truncate font-display text-xl">{activeCategoryName}</h2>
          <Button
            size="lg"
            className="h-12 shrink-0"
            disabled={categories.length === 0}
            onClick={() => setDraft(emptyItem(addItemTargetCategory))}
          >
            <Plus className="size-5" />
            Add Item
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((item) => (
            <article key={item.id} className="pos-card overflow-hidden">
              <img
                src={item.image || placeholder}
                alt={item.name}
                loading="lazy"
                width={512}
                height={512}
                className="h-24 w-full object-cover"
              />
              <div className="space-y-2 p-2.5">
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-sm leading-tight">{item.name}</h3>
                    <p className="mt-0.5 text-xs font-semibold text-primary">
                      {item.hasVariants
                        ? `${item.variants.length} variants · from ${NPR(lowestVariantPrice(item.variants))}`
                        : NPR(item.price ?? 0)}
                    </p>
                  </div>
                  {item.soldOut && (
                    <Badge className="shrink-0 bg-danger px-1.5 py-0 text-[10px] text-danger-foreground">
                      Sold Out
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
                  <Switch
                    checked={item.soldOut}
                    onCheckedChange={() => toggleSoldOut(item.id)}
                    aria-label="Toggle sold out"
                  />
                  <div className="flex gap-1">
                    <Button variant="outline" size="icon" className="size-8" aria-label="Edit item" onClick={() => setDraft(item)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 text-danger"
                      aria-label="Delete item"
                      onClick={() => setItemToDelete(item)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          ))}
          {items.length === 0 && (
            <p className="pos-card col-span-full p-8 text-sm text-muted-foreground">
              {isAll
                ? "No menu items yet. Pick a category and click Add Item to get started."
                : "No items in this category yet."}
            </p>
          )}
        </div>
      </section>

      <ConfirmDeleteDialog
        open={catToDelete !== null}
        title={`Delete "${catToDelete?.name}"?`}
        description="This removes the category. Items already in it will need a new category."
        onOpenChange={(open) => !open && setCatToDelete(null)}
        onConfirm={() => {
          if (catToDelete) deleteCategory(catToDelete.id);
          setCatToDelete(null);
        }}
      />

      <ConfirmDeleteDialog
        open={itemToDelete !== null}
        title={`Delete "${itemToDelete?.name}"?`}
        description="This removes the item from your menu. This can't be undone."
        onOpenChange={(open) => !open && setItemToDelete(null)}
        onConfirm={() => {
          if (itemToDelete) deleteMenuItem(itemToDelete.id);
          setItemToDelete(null);
        }}
      />

      <MenuItemDialog
        draft={draft}
        onClose={() => setDraft(null)}
        onSave={async (item) => {
          try {
            await saveMenuItem(item);
            setDraft(null);
          } catch (err) {
            const message = err instanceof ApiError ? err.message : "Failed to save item";
            toast.error(message);
          }
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
  onSave: (item: MenuItem) => Promise<void>;
}) {
  const { categories, branchId } = usePos();
  const [item, setItem] = useState<MenuItem | null>(draft);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (draft && (!item || item.id !== draft.id)) setItem(draft);
  if (!draft || !item) return null;

  const patch = (p: Partial<MenuItem>) => setItem((prev) => (prev ? { ...prev, ...p } : prev));
  const setVariant = (id: string, p: Partial<Variant>) =>
    setItem((prev) =>
      prev ? { ...prev, variants: prev.variants.map((v) => (v.id === id ? { ...v, ...p } : v)) } : prev,
    );

  const handleImageChange = async (file: File) => {
    if (!branchId) return;
    const localPreview = URL.createObjectURL(file);
    patch({ image: localPreview });
    setIsUploadingImage(true);
    try {
      const response = await uploadsApi.uploadMenuItemImage(branchId, file);
      if (response.data?.url) patch({ image: response.data.url });
    } catch {
      toast.error("Image upload failed. Try again.");
    } finally {
      setIsUploadingImage(false);
    }
  };

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
              <div className="relative">
                <img
                  src={item.image || placeholder}
                  alt=""
                  width={64}
                  height={64}
                  className="size-16 rounded-xl object-cover"
                />
                {isUploadingImage && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
                    <Loader2 className="size-5 animate-spin text-white" />
                  </div>
                )}
              </div>
              <Input
                type="file"
                accept="image/*"
                className="h-12"
                disabled={isUploadingImage}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImageChange(file);
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
          <Button variant="outline" className="h-12" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            className="h-12"
            disabled={!item.name || isUploadingImage || isSaving}
            onClick={async () => {
              setIsSaving(true);
              try {
                await onSave(item);
              } finally {
                setIsSaving(false);
              }
            }}
          >
            {isUploadingImage ? "Uploading image…" : isSaving ? "Saving…" : "Save item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
