import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NPR, type Employee } from "@/lib/pos/data";
import { usePos } from "@/lib/pos/store";

const blank = (): Employee => ({
  id: Math.random().toString(36).slice(2, 10),
  name: "",
  designation: "Waiter",
  phone: "",
  email: "",
  salary: 20000,
  shift: "11:00 AM - 9:00 PM",
  active: true,
});

export function EmployeesView() {
  const { employees, saveEmployee, deleteEmployee } = usePos();
  const [draft, setDraft] = useState<Employee | null>(null);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-display text-2xl">Employees</h2>
          <p className="text-xs text-muted-foreground">Simple staff tracker — no system access here</p>
        </div>
        <Button size="lg" className="h-12 shrink-0" onClick={() => setDraft(blank())}>
          <Plus className="size-5" />
          Add staff
        </Button>
      </div>

      {/* Mobile cards */}
      <ul className="grid gap-3 lg:hidden">
        {employees.map((e) => (
          <li key={e.id} className="pos-card p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <p className="truncate">{e.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {e.designation} · {e.phone}
                </p>
              </div>
              <Switch
                checked={e.active}
                aria-label={`${e.name} active`}
                onCheckedChange={(v) => saveEmployee({ ...e, active: v })}
              />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{e.shift}</span>
              <span className="font-semibold">{NPR(e.salary)}</span>
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" className="h-11 flex-1" onClick={() => setDraft(e)}>
                <Pencil className="size-4" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 text-danger"
                aria-label={`Delete ${e.name}`}
                onClick={() => deleteEmployee(e.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop table */}
      <div className="pos-card hidden overflow-x-auto p-4 lg:block sm:p-5">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="py-3 pr-3">Name</th>
              <th className="py-3 pr-3">Designation</th>
              <th className="py-3 pr-3">Phone</th>
              <th className="py-3 pr-3">Shift</th>
              <th className="py-3 pr-3">Salary</th>
              <th className="py-3 pr-3">Active</th>
              <th className="py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className="border-b border-border/70">
                <td className="py-3 pr-3">{e.name}</td>
                <td className="py-3 pr-3 text-muted-foreground">{e.designation}</td>
                <td className="py-3 pr-3 text-muted-foreground">{e.phone}</td>
                <td className="py-3 pr-3 text-muted-foreground">{e.shift}</td>
                <td className="py-3 pr-3 font-semibold">{NPR(e.salary)}</td>
                <td className="py-3 pr-3">
                  <Switch
                    checked={e.active}
                    aria-label={`${e.name} active`}
                    onCheckedChange={(v) => saveEmployee({ ...e, active: v })}
                  />
                </td>
                <td className="py-3">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="icon" className="size-10" aria-label={`Edit ${e.name}`} onClick={() => setDraft(e)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-10 text-danger"
                      aria-label={`Delete ${e.name}`}
                      onClick={() => deleteEmployee(e.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {draft && (
        <EmployeeDialog
          draft={draft}
          onClose={() => setDraft(null)}
          onSave={(emp) => {
            saveEmployee(emp);
            setDraft(null);
          }}
        />
      )}
    </div>
  );
}

function EmployeeDialog({
  draft,
  onClose,
  onSave,
}: {
  draft: Employee;
  onClose: () => void;
  onSave: (e: Employee) => void;
}) {
  const [emp, setEmp] = useState(draft);
  const patch = (p: Partial<Employee>) => setEmp({ ...emp, ...p });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {draft.name ? "Edit staff" : "Add staff"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Name</Label>
            <Input className="h-12" value={emp.name} onChange={(e) => patch({ name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Designation</Label>
            <Input className="h-12" value={emp.designation} onChange={(e) => patch({ designation: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input className="h-12" inputMode="tel" value={emp.phone} onChange={(e) => patch({ phone: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Shift timing</Label>
            <Input className="h-12" placeholder="11:00 AM - 9:00 PM" value={emp.shift} onChange={(e) => patch({ shift: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Monthly salary (NPR)</Label>
            <Input
              type="number"
              inputMode="numeric"
              className="h-12"
              value={emp.salary}
              onChange={(e) => patch({ salary: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Email (optional)</Label>
            <Input className="h-12" value={emp.email ?? ""} onChange={(e) => patch({ email: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-12" onClick={onClose}>
            Cancel
          </Button>
          <Button className="h-12" disabled={!emp.name} onClick={() => onSave(emp)}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
