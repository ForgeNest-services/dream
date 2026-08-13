import { useMemo, useState } from "react";
import { ChevronRight, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NPR, type Customer } from "@/lib/pos/data";
import { usePos } from "@/lib/pos/store";

// Reusable customer search + inline-create component. Used both in the
// khata payment step and the "new delivery" flow. Renders as a normal
// stack in the parent's dialog — no dialog of its own.
export function CustomerPicker({
  onPick,
  autoFocus = true,
}: {
  onPick: (customer: Customer) => void;
  autoFocus?: boolean;
}) {
  const { customers, saveCustomer } = usePos();
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftPhone, setDraftPhone] = useState("");
  const [draftAddress, setDraftAddress] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers.slice(0, 10);
    return customers
      .filter((c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q))
      .slice(0, 15);
  }, [customers, query]);

  if (showCreate) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Customer name</Label>
          <Input
            className="h-12"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input
            className="h-12"
            inputMode="tel"
            type="tel"
            value={draftPhone}
            onChange={(e) => setDraftPhone(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Address (optional)</Label>
          <Input
            className="h-12"
            value={draftAddress}
            onChange={(e) => setDraftAddress(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Notes (optional)</Label>
          <Textarea
            rows={2}
            value={draftNotes}
            onChange={(e) => setDraftNotes(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="h-11"
            onClick={() => setShowCreate(false)}
            disabled={isCreating}
          >
            Back to search
          </Button>
          <Button
            className="h-11"
            disabled={!draftName.trim() || isCreating}
            onClick={async () => {
              setIsCreating(true);
              const created = await saveCustomer({
                id: "",
                name: draftName.trim(),
                phone: draftPhone.trim(),
                address: draftAddress.trim(),
                notes: draftNotes.trim(),
                outstandingBalance: 0,
              });
              setIsCreating(false);
              if (created) onPick(created);
            }}
          >
            {isCreating ? "Saving…" : "Save & pick"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-11 pl-9"
          placeholder="Search by name or phone…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus={autoFocus}
        />
      </div>

      <div className="max-h-72 space-y-1.5 overflow-y-auto">
        {results.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick(c)}
            className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:border-primary hover:bg-secondary/60"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{c.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {c.phone || "no phone"}
                {c.address ? ` · ${c.address}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {c.outstandingBalance > 0 && (
                <span className="rounded-md bg-warning px-2 py-1 text-[11px] font-semibold text-navy">
                  Due {NPR(c.outstandingBalance)}
                </span>
              )}
              <ChevronRight className="size-4 text-muted-foreground" />
            </div>
          </button>
        ))}
        {results.length === 0 && (
          <p className="rounded-xl bg-secondary p-4 text-center text-xs text-muted-foreground">
            {query ? `No match for "${query}"` : "No customers yet — add the first below."}
          </p>
        )}
      </div>

      <Button
        variant="outline"
        className="h-11 w-full"
        onClick={() => {
          // Prefill the name field with the current search query if it looks
          // like a name (not a phone number) — nice shortcut.
          const q = query.trim();
          if (q && !/^[0-9+\-\s]+$/.test(q)) setDraftName(q);
          else if (q) setDraftPhone(q);
          setShowCreate(true);
        }}
      >
        <UserPlus className="size-4" />
        Add new customer
      </Button>
    </div>
  );
}
