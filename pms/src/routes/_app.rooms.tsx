import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMoney } from "@/lib/app-state";
import { rooms, roomStatusClass, roomStatusLabel, roomTypes } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/rooms")({
  head: () => ({
    meta: [
      { title: "Rooms & Room Types — Dream PMS" },
      {
        name: "description",
        content:
          "Manage every room, its rate, housekeeping status and the room types configured for the property.",
      },
      { property: "og:title", content: "Rooms & Room Types — Dream PMS" },
      {
        property: "og:description",
        content: "Manage rooms, rates, housekeeping status and room types.",
      },
    ],
  }),
  component: RoomsPage,
});

function RoomsPage() {
  const money = useMoney();
  const [open, setOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Rooms"
        subtitle={`${rooms.length} rooms · ${roomTypes.length} room types`}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="size-4" /> Add room
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-2xl">Add room</DialogTitle>
              </DialogHeader>
              <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setOpen(false);
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="num">Room number</Label>
                  <Input id="num" placeholder="401" />
                </div>
                <div className="space-y-2">
                  <Label>Room type</Label>
                  <Select defaultValue={roomTypes[0]!.name}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roomTypes.map((t) => (
                        <SelectItem key={t.id} value={t.name}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rate">Nightly rate</Label>
                  <Input id="rate" type="number" defaultValue={4500} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select defaultValue="available">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(roomStatusLabel).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter className="sm:col-span-2">
                  <Button type="submit">Save room</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Tabs defaultValue="rooms">
        <TabsList className="mb-5">
          <TabsTrigger value="rooms">All rooms</TabsTrigger>
          <TabsTrigger value="types">Room types</TabsTrigger>
        </TabsList>

        <TabsContent value="rooms">
          <section className="surface overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Room</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Floor</TableHead>
                  <TableHead className="text-right">Rate / night</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-display text-xl">{r.number}</TableCell>
                    <TableCell>{r.type}</TableCell>
                    <TableCell className="text-muted-foreground">{r.floor}</TableCell>
                    <TableCell className="text-right font-semibold">{money(r.rate)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={roomStatusClass[r.status]}>
                        {roomStatusLabel[r.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="gap-1.5">
                        <Pencil className="size-3.5" /> Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </TabsContent>

        <TabsContent value="types">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {roomTypes.map((t) => (
              <div key={t.id} className="surface p-5">
                <h3 className="text-2xl leading-none">{t.name}</h3>
                <p className="mt-2 text-xs text-muted-foreground">
                  Sleeps {t.capacity} · {t.count} rooms
                </p>
                <p className="mt-5 font-display text-3xl text-accent">{money(t.baseRate)}</p>
                <p className="text-xs text-muted-foreground">base rate per night</p>
                <Button variant="outline" size="sm" className="mt-5 w-full gap-1.5">
                  <Pencil className="size-3.5" /> Edit type
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
