import { DateText, EmptyState, PageHeader } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useApp } from "@/context/app-store";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/inventory/media")({
  head: () => ({
    meta: [
      { title: "Media Center — SROTA IMS" },
      {
        name: "description",
        content:
          "One shared image library for the whole catalogue. Products reference media items instead of uploading directly.",
      },
      { property: "og:title", content: "Media Center — SROTA IMS" },
      {
        property: "og:description",
        content: "Shared product image library with folders, search and usage counts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MediaPage,
});

function MediaPage() {
  const app = useApp();
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState("all");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [newFolder, setNewFolder] = useState("General");

  const folders = useMemo(
    () => Array.from(new Set(app.media.map((m) => m.folder))),
    [app.media],
  );

  const items = app.media.filter(
    (m) =>
      (folder === "all" || m.folder === folder) &&
      `${m.name} ${m.folder}`.toLowerCase().includes(q.trim().toLowerCase()),
  );

  const usage = (id: string) => app.products.filter((p) => p.mediaId === id).length;

  return (
    <div>
      <PageHeader
        title="Media Center"
        subtitle={`${app.media.length} images · shared across every product`}
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Upload className="mr-1.5 h-4 w-4" /> Upload image
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search images…"
            className="pl-8"
          />
        </div>
        <Select value={folder} onValueChange={setFolder}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All folders</SelectItem>
            {folders.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {items.length === 0 ? (
        <EmptyState title="No images here" description="Upload an image to get started." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((m) => (
            <figure key={m.id} className="overflow-hidden rounded-lg border bg-card">
              <img src={m.url} alt={m.name} loading="lazy" className="h-32 w-full object-cover" />
              <figcaption className="space-y-0.5 p-2">
                <p className="truncate text-xs font-medium">{m.name}</p>
                <p className="num text-[11px] text-muted-foreground">
                  {m.folder} · {m.sizeKb} KB
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Used by {usage(m.id)} product{usage(m.id) === 1 ? "" : "s"} ·{" "}
                  <DateText value={m.uploadedAt} />
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload image</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              <Upload className="mb-2 h-5 w-5" />
              Drop a file here — in this prototype, paste an image URL below.
            </div>
            <div className="space-y-1.5">
              <Label>Image name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Image URL</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Folder</Label>
              <Input value={newFolder} onChange={(e) => setNewFolder(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!name.trim() || !url.trim()) {
                  toast.error("Name and image URL are required");
                  return;
                }
                app.addMedia({
                  name: name.trim(),
                  url: url.trim(),
                  folder: newFolder.trim() || "General",
                  sizeKb: 120,
                });
                setName("");
                setUrl("");
                setOpen(false);
                toast.success("Image added to Media Center");
              }}
            >
              Add to library
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
