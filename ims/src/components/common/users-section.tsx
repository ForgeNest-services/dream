import { useEffect, useState } from "react";
import { Loader2, Plus, Pencil, Trash2, Building2, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useApp } from "@/context/app-store";
import { ApiError } from "@/lib/api-client";
import {
  staffCredentialsApi,
  type StaffCredentialDto,
} from "@/lib/staff-credentials-api";

const ROLES = [
  { code: "manager", label: "Manager", description: "Runs day-to-day inventory at one branch: stock levels, purchase orders, and reports for that branch only." },
  { code: "storekeeper", label: "Store Keeper", description: "Records stock in and out at one branch. No access to reports or settings." },
] as const;

type Slot = { role: string; branchId: string; branchName: string; cred: StaffCredentialDto | null };

export function UsersSection() {
  const app = useApp();
  const isOwner = app.currentUser?.role === "owner";
  const [creds, setCreds] = useState<StaffCredentialDto[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingSlot, setAddingSlot] = useState<Slot | null>(null);
  const [editingCred, setEditingCred] = useState<StaffCredentialDto | null>(null);
  const [deletingCred, setDeletingCred] = useState<StaffCredentialDto | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    staffCredentialsApi
      .list()
      .then((r) => setCreds(r.data ?? []))
      .catch((e: unknown) => toast.error(e instanceof ApiError ? e.message : "Failed to load users"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOwner) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner]);

  if (!isOwner) return null;

  if (loading || !app.branchesReady || creds === null) {
    return (
      <div className="flex items-center justify-center rounded-lg border bg-card p-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-center gap-2">
        <UsersIcon className="h-5 w-5 text-primary" />
        <p className="text-sm font-medium">Staff logins</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Create logins for your staff — each role signs in at this app's login screen with a shared
        username and password for that role and branch.
      </p>

      <div className="mt-4 space-y-4">
        {app.branches.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add a branch first — staff roles are tied to a location.</p>
        ) : (
          ROLES.map((r) => {
            const slots: Slot[] = app.branches.map((b) => ({
              role: r.code,
              branchId: b.id,
              branchName: b.name,
              cred: creds.find((c) => c.role === r.code && c.branch_id === b.id) ?? null,
            }));
            const filledCount = slots.filter((s) => s.cred).length;

            return (
              <div key={r.code} className="overflow-hidden rounded-md border">
                <div className="flex items-start justify-between gap-3 border-b bg-muted/40 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{r.label}</p>
                      <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        Per branch
                      </span>
                    </div>
                    <p className="mt-1 max-w-md text-xs text-muted-foreground">{r.description}</p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">
                    {filledCount}/{slots.length} set up
                  </span>
                </div>
                <div>
                  {slots.map((slot) => (
                    <div
                      key={slot.branchId}
                      className="flex items-center justify-between gap-3 border-b p-3 text-sm last:border-b-0"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="shrink-0 font-medium">{slot.branchName}</span>
                        {slot.cred ? (
                          <span className="num truncate text-xs text-muted-foreground">
                            · {slot.cred.username}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">· No login yet</span>
                        )}
                      </div>
                      {slot.cred ? (
                        <div className="flex shrink-0 gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => setEditingCred(slot.cred)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeletingCred(slot.cred)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 shrink-0 gap-1 text-xs"
                          onClick={() => setAddingSlot(slot)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Create login
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {addingSlot && (
        <CreateDialog
          slot={addingSlot}
          saving={saving}
          onClose={() => setAddingSlot(null)}
          onSubmit={async (username, password) => {
            setSaving(true);
            try {
              await staffCredentialsApi.create({
                role: addingSlot.role,
                username,
                password,
                branch_id: addingSlot.branchId,
              });
              toast.success(`Login created for ${addingSlot.role}`);
              setAddingSlot(null);
              load();
            } catch (e) {
              const err = e as ApiError;
              if (err.code === "USERNAME_TAKEN") toast.error("That username is already in use. Pick another.");
              else if (err.code === "ROLE_ALREADY_HAS_CREDENTIAL") toast.error("A login already exists for this role and branch.");
              else toast.error(err.message || "Failed to create login");
            } finally {
              setSaving(false);
            }
          }}
        />
      )}

      {editingCred && (
        <EditDialog
          cred={editingCred}
          saving={saving}
          onClose={() => setEditingCred(null)}
          onSubmit={async (username, password) => {
            const payload: { username?: string; password?: string } = {};
            if (username && username !== editingCred.username) payload.username = username;
            if (password) payload.password = password;
            if (Object.keys(payload).length === 0) {
              setEditingCred(null);
              return;
            }
            setSaving(true);
            try {
              await staffCredentialsApi.update(editingCred.id, payload);
              toast.success("Login updated");
              setEditingCred(null);
              load();
            } catch (e) {
              const err = e as ApiError;
              if (err.code === "USERNAME_TAKEN") toast.error("That username is already in use.");
              else toast.error(err.message || "Failed to update login");
            } finally {
              setSaving(false);
            }
          }}
        />
      )}

      <AlertDialog open={!!deletingCred} onOpenChange={(o) => !o && setDeletingCred(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this login?</AlertDialogTitle>
            <AlertDialogDescription>
              Staff currently signed in stay signed in until their session expires. After that, this
              login stops working — you can create a new one any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                if (!deletingCred) return;
                try {
                  await staffCredentialsApi.remove(deletingCred.id);
                  toast.success("Login removed");
                  setDeletingCred(null);
                  load();
                } catch (err) {
                  toast.error(err instanceof ApiError ? err.message : "Failed to remove login");
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CreateDialog({
  slot,
  saving,
  onClose,
  onSubmit,
}: {
  slot: Slot;
  saving: boolean;
  onClose: () => void;
  onSubmit: (username: string, password: string) => Promise<void>;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const roleLabel = ROLES.find((r) => r.code === slot.role)?.label ?? slot.role;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New {roleLabel} login — {slot.branchName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Username</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={`e.g. ${slot.role}-${slot.branchName.toLowerCase().replace(/\s+/g, "-")}`}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Share these with your {roleLabel.toLowerCase()} staff at {slot.branchName}. Anyone with the
            login can sign in — it's shared, not per-person.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            disabled={saving || username.trim().length < 3 || password.length < 6}
            onClick={() => onSubmit(username.trim(), password)}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create login"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  cred,
  saving,
  onClose,
  onSubmit,
}: {
  cred: StaffCredentialDto;
  saving: boolean;
  onClose: () => void;
  onSubmit: (username: string, password: string) => Promise<void>;
}) {
  const [username, setUsername] = useState(cred.username);
  const [password, setPassword] = useState("");
  const roleLabel = ROLES.find((r) => r.code === cred.role)?.label ?? cred.role;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {roleLabel} login</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Username</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">New password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep current"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Staff already signed in stay signed in until their session expires. New logins need the
            updated password.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            disabled={saving || username.trim().length < 3}
            onClick={() => onSubmit(username.trim(), password)}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
