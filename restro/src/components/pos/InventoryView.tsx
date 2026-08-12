import { useState } from "react";
import { History, PackagePlus, Pencil, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { NPR, type InventoryItem } from "@/lib/pos/data";
import { usePos } from "@/lib/pos/store";

const REASONS = ["Damage", "Loss", "Internal Use", "Correction", "Other"];

function statusOf(i: InventoryItem) {
  if (i.stock === 0) return { label: "Out of stock", cls: "bg-danger text-danger-foreground" };
  if (i.stock <= i.threshold) return { label: "Low", cls: "bg-warning text-navy" };
  return { label: "In stock", cls: "bg-success text-success-foreground" };
}

export function InventoryView() {
  const {
    inventory,
    inventoryLoading,
    movements,
    loadMovements,
    restock,
    adjustStock,
    saveInventoryItem,
    deleteInventoryItem,
  } = usePos();
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [restockItem, setRestockItem] = useState<InventoryItem | null>(null);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);

  const [qty, setQty] = useState(0);
  const [cost, setCost] = useState(0);
  const [supplier, setSupplier] = useState("");
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState(REASONS[0]!);
  const [note, setNote] = useState("");

  return (
    <div className="space-y-4">
      <div className="pos-card p-4 sm:p-5">
        <h2 className="font-display text-xl">Inventory</h2>
        <p className="text-sm text-muted-foreground">
          Standalone manual tracking. Orders never change stock automatically.
        </p>
        <Button
          className="mt-3 h-11"
          onClick={() =>
            setEditItem({ id: "", name: "", category: "Grocery", stock: 0, unit: "kg", threshold: 5 })
          }
        >
          <PackagePlus className="size-4" />
          New item
        </Button>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <th className="py-3 pr-3">Item</th>
                <th className="py-3 pr-3">Category</th>
                <th className="py-3 pr-3">Stock</th>
                <th className="py-3 pr-3">Threshold</th>
                <th className="py-3 pr-3">Status</th>
                <th className="py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {inventoryLoading && inventory.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Loading inventory…
                  </td>
                </tr>
              )}
              {!inventoryLoading && inventory.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    No items yet — add your first with the button above.
                  </td>
                </tr>
              )}
              {inventory.map((i) => {
                const st = statusOf(i);
                return (
                  <tr key={i.id} className="border-b border-border/70">
                    <td className="py-3 pr-3 font-medium">{i.name}</td>
                    <td className="py-3 pr-3 text-muted-foreground">{i.category}</td>
                    <td className="py-3 pr-3 font-display text-xl">
                      {i.stock} <span className="text-xs font-sans font-semibold text-muted-foreground">{i.unit}</span>
                    </td>
                    <td className="py-3 pr-3 text-muted-foreground">
                      {i.threshold} {i.unit}
                    </td>
                    <td className="py-3 pr-3">
                      <span className={`rounded-md px-2 py-1 text-xs font-medium ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          className="h-10"
                          onClick={() => {
                            setRestockItem(i);
                            setQty(0);
                            setCost(0);
                            setSupplier("");
                          }}
                        >
                          <PackagePlus className="size-4" />
                          Restock
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-10"
                          onClick={() => {
                            setAdjustItem(i);
                            setDelta(0);
                            setNote("");
                          }}
                        >
                          <SlidersHorizontal className="size-4" />
                          Adjust
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-10"
                          onClick={() => {
                            setHistoryItem(i);
                            void loadMovements(i.id);
                          }}
                        >
                          <History className="size-4" />
                          History
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-10"
                          aria-label={`Edit ${i.name}`}
                          onClick={() => setEditItem(i)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-10 text-danger"
                          aria-label={`Delete ${i.name}`}
                          onClick={() => deleteInventoryItem(i.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {editItem?.id ? `Edit ${editItem.name}` : "New item"}
            </DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input className="h-12" value={editItem.name} onChange={(e) => setEditItem({ ...editItem, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input className="h-12" value={editItem.category} onChange={(e) => setEditItem({ ...editItem, category: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{editItem.id ? "Stock (adjust only)" : "Opening stock"}</Label>
                  <Input
                    type="number"
                    min={0}
                    className="h-12"
                    value={editItem.stock}
                    disabled={!!editItem.id}
                    readOnly={!!editItem.id}
                    onChange={(e) =>
                      setEditItem({ ...editItem, stock: Math.max(0, Number(e.target.value)) })
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {editItem.id
                      ? "Use Restock or Adjust to change stock — keeps the audit log clean."
                      : "How much you have on hand right now. Logged as an “Initial stock” movement."}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Low-stock alert at</Label>
                  <Input
                    type="number"
                    min={0}
                    className="h-12"
                    value={editItem.threshold}
                    onChange={(e) =>
                      setEditItem({ ...editItem, threshold: Math.max(0, Number(e.target.value)) })
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    The item is flagged “Low” when stock drops to this value or below.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={editItem.unit} onValueChange={(v) => setEditItem({ ...editItem, unit: v as InventoryItem["unit"] })}>
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["kg", "liter", "piece", "packet"] as const).map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              className="h-12 w-full"
              onClick={async () => {
                if (!editItem) return;
                // Server assigns the id — pass empty string for a new item and
                // the store's saveInventoryItem branches on inventory.some(...).
                await saveInventoryItem(editItem);
                setEditItem(null);
              }}
            >
              Save item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!restockItem} onOpenChange={(o) => !o && setRestockItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Restock {restockItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Quantity added ({restockItem?.unit})</Label>
              <Input type="number" className="h-12" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Cost price (NPR)</Label>
              <Input type="number" className="h-12" value={cost} onChange={(e) => setCost(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Supplier note (optional)</Label>
              <Textarea value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button
              className="h-12 w-full"
              onClick={() => {
                if (restockItem) restock(restockItem.id, qty, cost, supplier);
                setRestockItem(null);
              }}
            >
              Save restock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!adjustItem} onOpenChange={(o) => !o && setAdjustItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Adjust {adjustItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Change (+/-) in {adjustItem?.unit}</Label>
              <div className="flex gap-2">
                <Button variant="outline" className="h-12 w-14" onClick={() => setDelta(delta - 1)}>
                  -
                </Button>
                <Input
                  type="number"
                  className="h-12 text-center"
                  value={delta}
                  onChange={(e) => setDelta(Number(e.target.value))}
                />
                <Button variant="outline" className="h-12 w-14" onClick={() => setDelta(delta + 1)}>
                  +
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button
              className="h-12 w-full"
              onClick={() => {
                if (adjustItem) adjustStock(adjustItem.id, delta, reason, note);
                setAdjustItem(null);
              }}
            >
              Save adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyItem} onOpenChange={(o) => !o && setHistoryItem(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Movement log · {historyItem?.name}</DialogTitle>
          </DialogHeader>
          <ul className="space-y-3">
            {movements
              .filter((m) => m.itemId === historyItem?.id)
              .map((m) => (
                <li key={m.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">
                      {m.delta > 0 ? "+" : ""}
                      {m.delta} {historyItem?.unit}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(m.at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm">
                    {m.reason}
                    {m.cost ? ` · cost ${NPR(m.cost)}` : ""}
                  </p>
                  {m.note && <p className="text-xs text-muted-foreground">{m.note}</p>}
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">by {m.by}</p>
                </li>
              ))}
            {movements.filter((m) => m.itemId === historyItem?.id).length === 0 && (
              <li className="text-sm text-muted-foreground">No movements recorded yet.</li>
            )}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
