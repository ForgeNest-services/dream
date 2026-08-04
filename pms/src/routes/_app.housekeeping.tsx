import { createFileRoute } from "@tanstack/react-router";
import { BrushCleaning, CheckCircle2, Clock, Wrench } from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/lib/app-state";
import { rooms } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/housekeeping")({
  head: () => ({
    meta: [
      { title: "Housekeeping Board — Dream PMS" },
      {
        name: "description",
        content:
          "Track room cleaning tasks, assign housekeepers and move rooms from dirty to inspected across your property.",
      },
      { property: "og:title", content: "Housekeeping Board — Dream PMS" },
      {
        property: "og:description",
        content:
          "Track room cleaning tasks, assign housekeepers and move rooms from dirty to inspected across your property.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HousekeepingPage,
});

type TaskStage = "dirty" | "in-progress" | "inspected";

type Task = {
  id: string;
  room: string;
  type: string;
  floor: number;
  stage: TaskStage;
  priority: "high" | "normal";
  note: string;
  assignee: string;
};

const HOUSEKEEPERS = ["Unassigned", "Maya Tamang", "Ram Bahadur", "Sabina Lama", "Hari Magar"];

const STAGES: { id: TaskStage; label: string; icon: typeof Clock; hint: string }[] = [
  { id: "dirty", label: "To clean", icon: BrushCleaning, hint: "Departed or stayover, awaiting service" },
  { id: "in-progress", label: "In progress", icon: Clock, hint: "Housekeeper currently in the room" },
  { id: "inspected", label: "Inspected", icon: CheckCircle2, hint: "Ready to sell" },
];

const NOTES = [
  "Departure clean — full linen change",
  "Stayover refresh — towels & amenities",
  "Deep clean requested by guest",
  "Late checkout, start after 14:00",
  "Extra bed to be removed",
];

function seedTasks(): Task[] {
  return rooms
    .filter((r) => r.status === "cleaning" || r.status === "maintenance" || r.id.endsWith("2"))
    .slice(0, 12)
    .map((r, i) => ({
      id: r.id,
      room: r.number,
      type: r.type,
      floor: r.floor,
      stage: (["dirty", "dirty", "in-progress", "inspected"] as TaskStage[])[i % 4]!,
      priority: i % 4 === 0 ? "high" : "normal",
      note: NOTES[i % NOTES.length]!,
      assignee: i % 3 === 0 ? "Unassigned" : HOUSEKEEPERS[(i % 4) + 1]!,
    }));
}

function HousekeepingPage() {
  const { property } = useApp();
  const [tasks, setTasks] = useState<Task[]>(seedTasks);
  const [floor, setFloor] = useState("all");

  const visible = useMemo(
    () => tasks.filter((t) => floor === "all" || String(t.floor) === floor),
    [tasks, floor],
  );

  const move = (id: string, stage: TaskStage) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, stage } : t)));
  const assign = (id: string, assignee: string) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, assignee } : t)));

  const maintenance = rooms.filter((r) => r.status === "maintenance");

  return (
    <>
      <PageHeader
        title="Housekeeping board"
        subtitle={`Room servicing queue · ${property.name}`}
        action={
          <Select value={floor} onValueChange={setFloor}>
            <SelectTrigger className="h-10 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All floors</SelectItem>
              {[1, 2, 3].map((f) => (
                <SelectItem key={f} value={String(f)}>
                  Floor {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {STAGES.map((stage) => {
          const items = visible.filter((t) => t.stage === stage.id);
          return (
            <section key={stage.id} className="surface flex flex-col p-4">
              <header className="mb-4 flex items-start justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-2 text-xl">
                    <stage.icon className="size-[18px] text-accent" />
                    {stage.label}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">{stage.hint}</p>
                </div>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">
                  {items.length}
                </span>
              </header>

              <div className="space-y-3">
                {items.length === 0 && (
                  <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                    Nothing here right now.
                  </p>
                )}
                {items.map((t) => (
                  <article
                    key={t.id}
                    className={cn(
                      "rounded-xl border border-border bg-background p-3",
                      t.priority === "high" && "border-l-4 border-l-accent",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-display text-lg leading-none">Room {t.room}</p>
                      {t.priority === "high" && <Badge variant="secondary">Priority</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.type} · Floor {t.floor}
                    </p>
                    <p className="mt-2 text-xs">{t.note}</p>

                    <Select value={t.assignee} onValueChange={(v) => assign(t.id, v)}>
                      <SelectTrigger className="mt-3 h-9 w-full text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HOUSEKEEPERS.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="mt-3 flex gap-2">
                      {stage.id !== "dirty" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 flex-1 text-xs"
                          onClick={() =>
                            move(t.id, stage.id === "inspected" ? "in-progress" : "dirty")
                          }
                        >
                          Move back
                        </Button>
                      )}
                      {stage.id !== "inspected" && (
                        <Button
                          size="sm"
                          className="h-8 flex-1 text-xs"
                          onClick={() =>
                            move(t.id, stage.id === "dirty" ? "in-progress" : "inspected")
                          }
                        >
                          {stage.id === "dirty" ? "Start clean" : "Mark inspected"}
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <section className="surface mt-6 p-5">
        <h2 className="flex items-center gap-2 text-xl">
          <Wrench className="size-[18px] text-accent" />
          Maintenance watchlist
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Rooms blocked from sale until engineering signs off.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {maintenance.map((r) => (
            <li key={r.id} className="rounded-xl border border-border bg-background p-3">
              <p className="font-display text-lg leading-none">Room {r.number}</p>
              <p className="mt-1 text-xs text-muted-foreground">{r.type}</p>
              <p className="mt-2 text-xs text-destructive">Out of order</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
