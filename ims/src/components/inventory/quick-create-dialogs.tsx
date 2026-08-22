import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/context/app-store";
import { toast } from "sonner";

/** Small single-field create dialogs for Category/Brand — an explicit
 *  alternative to the combobox's inline "type to create" affordance, for
 *  anyone who doesn't notice that trick. Both close on success and hand the
 *  new id back via onCreated so the caller can select it immediately. */
export function CreateCategoryDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (categoryId: string) => void;
}) {
  const app = useApp();
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>("none");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName("");
    setParentId("none");
  };

  const save = async () => {
    if (!name.trim()) {
      toast.error("Category name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await app.addCategory(name.trim(), parentId === "none" ? null : parentId);
      if (!res.ok || !res.category) {
        toast.error(res.error ?? "Failed to create category");
        return;
      }
      toast.success(`Category "${name.trim()}" created`);
      onCreated(res.category.id);
      onOpenChange(false);
      reset();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (onOpenChange(o), !o && reset())}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New category</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Beverages"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && void save()}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Parent category (optional)</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="none">No parent — top level</SelectItem>
                {app.categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {app.categoryPath(c.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Creating…" : "Create category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CreateBrandDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (brandId: string) => void;
}) {
  const app = useApp();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      toast.error("Brand name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await app.addBrand(name.trim());
      if (!res.ok || !res.brand) {
        toast.error(res.error ?? "Failed to create brand");
        return;
      }
      toast.success(`Brand "${name.trim()}" created`);
      onCreated(res.brand.id);
      onOpenChange(false);
      setName("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (onOpenChange(o), !o && setName(""))}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New brand</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label className="text-xs">Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Nestlé"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && void save()}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Creating…" : "Create brand"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
