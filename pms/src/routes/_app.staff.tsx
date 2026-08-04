import { createFileRoute } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PROPERTIES } from "@/lib/app-state";
import { ALL_ROLES, ROLE_LABELS } from "@/lib/roles";
import { staff } from "@/lib/mock-data";

// legacy shim so this mock staff page still renders while we decide its fate
const ROLES = ALL_ROLES.map((code) => ROLE_LABELS[code]);

export const Route = createFileRoute("/_app/staff")({
  head: () => ({
    meta: [
      { title: "Staff & Users — Dream PMS" },
      {
        name: "description",
        content:
          "Manage hotel staff accounts, roles and property assignments, and invite new team members.",
      },
      { property: "og:title", content: "Staff & Users — Dream PMS" },
      {
        property: "og:description",
        content: "Manage staff accounts, roles and property assignments.",
      },
    ],
  }),
  component: StaffPage,
});

function StaffPage() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Staff & users"
        subtitle="Who can access this property and what they can do"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus className="size-4" /> Invite staff
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-2xl">Invite staff member</DialogTitle>
                <DialogDescription>
                  They receive an email invitation to set their own password.
                </DialogDescription>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  setOpen(false);
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input id="email" type="email" placeholder="name@hotel.com" required />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select defaultValue="Front Desk">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Property assignment</Label>
                  <Select defaultValue="hg">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROPERTIES.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — {p.location}
                        </SelectItem>
                      ))}
                      <SelectItem value="all">All properties</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="submit">Send invite</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <section className="surface overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-semibold">{s.name}</TableCell>
                <TableCell className="text-muted-foreground">{s.email}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="border-accent/25 bg-accent/10 text-accent">
                    {s.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {s.active ? "Active" : "Suspended"}
                </TableCell>
                <TableCell className="text-right">
                  <Switch defaultChecked={s.active} aria-label={`Toggle ${s.name}`} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </>
  );
}
