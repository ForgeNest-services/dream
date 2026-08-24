import { DateText, EmptyState, PageHeader } from "@/components/common/primitives";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useApp } from "@/context/app-store";
import type { MediaItem } from "@/data/types";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/inventory/media")({
  head: () => ({
    meta: [
      { title: "Media Center — SROTA IMS" },
      {
        name: "description",
        content: "One shared image library for the whole catalogue. Products reference media items instead of uploading directly.",
      },
      { property: "og:title", content: "Media Center — SROTA IMS" },
      {
        property: "og:description",
        content: "Shared product image library with search and usage counts.",
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
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteFor, setDeleteFor] = useState<MediaItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const items = app.media.filter((m) => m.name.toLowerCase().includes(q.trim().toLowerCase()));

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

      <div className="relative mb-3 max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search images…" className="pl-8" />
      </div>

      {items.length === 0 ? (
        <EmptyState title="No images here" description="Upload an image to get started." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((m) => {
            const usedBy = usage(m.id);
            return (
              <figure key={m.id} className="group relative overflow-hidden rounded-lg border bg-card">
                <img src={m.url} alt={m.name} loading="lazy" className="h-32 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setDeleteFor(m)}
                  className="absolute right-1.5 top-1.5 rounded-md bg-background/90 p-1.5 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-destructive group-hover:opacity-100"
                  aria-label={`Delete ${m.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <figcaption className="space-y-0.5 p-2">
                  <p className="truncate text-xs font-medium">{m.name}</p>
                  <p className="num text-[11px] text-muted-foreground">{m.sizeKb} KB</p>
                  <p className="text-[11px] text-muted-foreground">
                    Used by {usedBy} product{usedBy === 1 ? "" : "s"} · <DateText value={m.uploadedAt} />
                  </p>
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setSelectedFile(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload image</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground hover:border-primary/50"
            >
              <Upload className="mb-2 h-5 w-5" />
              {selectedFile ? selectedFile.name : "Click to choose an image"}
            </button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={uploading}
              onClick={async () => {
                if (!selectedFile) {
                  toast.error("Choose an image first");
                  return;
                }
                setUploading(true);
                try {
                  const res = await app.addMedia(selectedFile, "Uploads");
                  if (!res.ok) {
                    toast.error(res.error ?? "Upload failed");
                    return;
                  }
                  setSelectedFile(null);
                  setOpen(false);
                  toast.success("Image added to Media Center");
                } finally {
                  setUploading(false);
                }
              }}
            >
              {uploading ? "Uploading…" : "Add to library"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteFor !== null} onOpenChange={(o) => !o && setDeleteFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteFor?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the image from the Media Center. It can't be used if you're
              still using it on a product — remove it from that product's image field first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={async (e) => {
                e.preventDefault();
                if (!deleteFor) return;
                setDeleting(true);
                try {
                  const res = await app.deleteMedia(deleteFor.id);
                  if (!res.ok) {
                    toast.error(res.error ?? "Failed to delete image");
                    return;
                  }
                  toast.success("Image deleted");
                  setDeleteFor(null);
                } finally {
                  setDeleting(false);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
