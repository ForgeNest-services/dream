import { useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Building2,
  Users as UsersIcon,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePos } from "@/lib/pos/store";
import { ApiError } from "@/lib/api-client";
import {
  staffCredentialsApi,
  type StaffCredentialDto,
  type CreateStaffCredentialPayload,
} from "@/lib/staff-credentials-api";

const ROLES = [
  {
    code: "manager",
    label: "Manager",
    scoped: true,
    description: "Runs day-to-day operations at one branch.",
  },
  {
    code: "waiter",
    label: "Waiter",
    scoped: true,
    description: "Takes and serves orders at one branch.",
  },
  {
    code: "chef",
    label: "Chef",
    scoped: true,
    description: "Views and updates order status in the kitchen.",
  },
] as const;

type RoleCode = (typeof ROLES)[number]["code"];

export function UsersSection() {
  const { canSwitchBranch, branches, branchesLoading } = usePos();
  const [creds, setCreds] = useState<StaffCredentialDto[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    manager: true,
    waiter: true,
    chef: true,
  });
  const [addingRole, setAddingRole] = useState<RoleCode | null>(null);
  const [editingCred, setEditingCred] = useState<StaffCredentialDto | null>(null);
  const [deletingCred, setDeletingCred] = useState<StaffCredentialDto | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    staffCredentialsApi
      .list()
      .then((r) => setCreds(r.data ?? []))
      .catch((e: unknown) =>
        toast.error(e instanceof ApiError ? e.message : "Failed to load users")
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (canSwitchBranch) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSwitchBranch]);

  if (!canSwitchBranch) return null;

  if (loading || branchesLoading || creds === null) {
    return (
      <div className="pos-card flex items-center justify-center p-10">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const toggle = (role: string) =>
    setExpanded((prev) => ({ ...prev, [role]: !prev[role] }));

  return (
    <div className="pos-card p-5">
      <div className="flex items-center gap-2">
        <UsersIcon className="size-5 text-primary" />
        <h2 className="font-display text-xl">Users</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Create individual logins for each staff member. Each person gets their own name (shown on
        bills) and username (used to sign in).
      </p>

      <div className="mt-4 space-y-3">
        {ROLES.map((r) => {
          const roleCreds = creds.filter((c) => c.role === r.code);
          const isOpen = expanded[r.code] ?? true;

          return (
            <div key={r.code} className="overflow-hidden rounded-xl border border-border">
              {/* Role header */}
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 border-b border-border bg-secondary/40 p-4"
                onClick={() => toggle(r.code)}
              >
                <div className="flex items-center gap-3 text-left">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{r.label}</p>
                      <span className="rounded-md bg-accent/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        Per branch
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{r.description}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {roleCreds.length} account{roleCreds.length !== 1 ? "s" : ""}
                  </span>
                  {isOpen ? (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {isOpen && (
                <div>
                  {roleCreds.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-muted-foreground">
                      No {r.label.toLowerCase()} accounts yet.
                    </p>
                  ) : (
                    roleCreds.map((cred) => {
                      const branch = branches.find((b) => b.id === cred.branch_id);
                      return (
                        <div
                          key={cred.id}
                          className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3 last:border-b-0"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-sm font-medium">
                              {cred.name}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="font-mono">{cred.username}</span>
                              {branch && (
                                <>
                                  <span>·</span>
                                  <Building2 className="size-3 shrink-0" />
                                  <span>{branch.name}</span>
                                </>
                              )}
                              {cred.phone && (
                                <>
                                  <span>·</span>
                                  <span>{cred.phone}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8"
                              onClick={() => setEditingCred(cred)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8 text-danger hover:text-danger"
                              onClick={() => setDeletingCred(cred)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div className="border-t border-border/60 px-4 py-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 text-xs"
                      onClick={() => setAddingRole(r.code)}
                    >
                      <Plus className="size-3.5" />
                      Add {r.label}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {addingRole && (
        <CreateDialog
          role={addingRole}
          roleLabel={ROLES.find((r) => r.code === addingRole)?.label ?? addingRole}
          branches={branches}
          saving={saving}
          onClose={() => setAddingRole(null)}
          onSubmit={async (payload) => {
            setSaving(true);
            try {
              await staffCredentialsApi.create(payload);
              toast.success("Account created");
              setAddingRole(null);
              load();
            } catch (e) {
              const err = e as ApiError;
              if (err.code === "USERNAME_TAKEN")
                toast.error("That username is already taken. Pick another.");
              else if (err.code === "BRANCH_REQUIRED")
                toast.error("Please select a branch for this role.");
              else toast.error(err.message || "Failed to create account");
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
          onSubmit={async (payload) => {
            setSaving(true);
            try {
              await staffCredentialsApi.update(editingCred.id, payload);
              toast.success("Account updated");
              setEditingCred(null);
              load();
            } catch (e) {
              const err = e as ApiError;
              if (err.code === "USERNAME_TAKEN")
                toast.error("That username is already taken.");
              else toast.error(err.message || "Failed to update account");
            } finally {
              setSaving(false);
            }
          }}
        />
      )}

      <AlertDialog open={!!deletingCred} onOpenChange={(o) => !o && setDeletingCred(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deletingCred?.name}'s account?</AlertDialogTitle>
            <AlertDialogDescription>
              If they're currently signed in, their session stays active until it expires (8 hours).
              After that, this login stops working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-danger-foreground hover:bg-danger/90"
              onClick={async () => {
                if (!deletingCred) return;
                try {
                  await staffCredentialsApi.remove(deletingCred.id);
                  toast.success("Account removed");
                  setDeletingCred(null);
                  load();
                } catch (e) {
                  toast.error(e instanceof ApiError ? e.message : "Failed to remove account");
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
  role,
  roleLabel,
  branches,
  saving,
  onClose,
  onSubmit,
}: {
  role: RoleCode;
  roleLabel: string;
  branches: { id: string; name: string }[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateStaffCredentialPayload) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");

  const valid = name.trim().length > 0 && username.trim().length >= 3 && password.length >= 6 && !!branchId;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add {roleLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Branch</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>
              Full name <span className="text-danger">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ramesh Shrestha"
            />
            <p className="text-[11px] text-muted-foreground">
              Shown on printed bills as "Entered by".
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="98XXXXXXXX"
                inputMode="tel"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="optional"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>
              Username <span className="text-danger">*</span>
            </Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={`e.g. ${role}-ktm-1`}
            />
            <p className="text-[11px] text-muted-foreground">
              Globally unique — used only to sign in, not shown on bills.
            </p>
          </div>
          <div className="space-y-2">
            <Label>
              Password <span className="text-danger">*</span>
            </Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            disabled={saving || !valid}
            onClick={() =>
              onSubmit({
                role,
                name: name.trim(),
                email: email.trim() || null,
                phone: phone.trim() || null,
                username: username.trim(),
                password,
                branch_id: branchId,
              })
            }
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Create account"}
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
  onSubmit: (payload: { name?: string; email?: string | null; phone?: string | null; username?: string; password?: string }) => Promise<void>;
}) {
  const [name, setName] = useState(cred.name);
  const [email, setEmail] = useState(cred.email ?? "");
  const [phone, setPhone] = useState(cred.phone ?? "");
  const [username, setUsername] = useState(cred.username);
  const [password, setPassword] = useState("");

  const roleLabel = ROLES.find((r) => r.code === cred.role)?.label ?? cred.role;

  const handleSubmit = () => {
    const payload: Parameters<typeof onSubmit>[0] = {};
    if (name.trim() && name.trim() !== cred.name) payload.name = name.trim();
    if (email.trim() !== (cred.email ?? "")) payload.email = email.trim() || null;
    if (phone.trim() !== (cred.phone ?? "")) payload.phone = phone.trim() || null;
    if (username.trim() !== cred.username) payload.username = username.trim();
    if (password) payload.password = password;
    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }
    onSubmit(payload);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {roleLabel} — {cred.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="98XXXXXXXX"
                inputMode="tel"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="optional"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Username</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>New password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep current"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Active sessions stay active until they expire. New logins use the updated credentials.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button disabled={saving || name.trim().length === 0 || username.trim().length < 3} onClick={handleSubmit}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
