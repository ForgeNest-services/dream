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
import { useApp } from "@/context/app-store";
import { cn } from "@/lib/utils";
import { ImagePlus, Search, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

export function MediaThumb({
  mediaId,
  className,
  alt,
}: {
  mediaId?: string | undefined;
  className?: string;
  alt: string;
}) {
  const { media } = useApp();
  const item = media.find((m) => m.id === mediaId);
  if (!item) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md border bg-muted/50 text-muted-foreground",
          className,
        )}
        aria-hidden
      >
        <ImagePlus className="h-4 w-4" />
      </div>
    );
  }
  return (
    <img
      src={item.url}
      alt={alt}
      loading="lazy"
      className={cn("rounded-md border object-cover", className)}
    />
  );
}

export function MediaPicker({
  value,
  onChange,
  label,
  thumbClassName,
}: {
  value?: string | undefined;
  onChange: (id: string | undefined) => void;
  label?: string;
  thumbClassName?: string;
}) {
  const app = useApp();
  const { media } = app;
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | undefined>(value);

  const filtered = media.filter((m) =>
    `${m.name} ${m.folder}`.toLowerCase().includes(q.trim().toLowerCase()),
  );

  const upload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const created = app.addMedia({
        name: file.name.replace(/\.[^.]+$/, ""),
        url: String(reader.result),
        folder: "Uploads",
        sizeKb: Math.round(file.size / 1024),
      });
      setSel(created.id);
      toast.success("Uploaded to Media Center");
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <MediaThumb
        mediaId={value}
        alt={label ?? "Product image"}
        className={cn("h-16 w-16 shrink-0 object-cover", thumbClassName)}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="sm" onClick={() => setSel(value)}>
            <ImagePlus className="mr-2 h-4 w-4" />
            {value ? "Change image" : (label ?? "Choose from Media Center")}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Media Center</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" /> Upload new image
            </Button>
            <p className="text-xs text-muted-foreground">
              Uploads are saved to the Media Center so they can be reused later.
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search images…"
              className="pl-8"
            />
          </div>
          <div className="grid max-h-[50vh] grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-5">
            {filtered.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSel(m.id)}
                className={cn(
                  "group overflow-hidden rounded-md border text-left transition",
                  sel === m.id ? "ring-2 ring-primary" : "hover:border-primary/50",
                )}
              >
                <img src={m.url} alt={m.name} className="h-20 w-full object-cover" />
                <p className="truncate px-1.5 py-1 text-[11px] text-muted-foreground">{m.name}</p>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
            >
              Remove image
            </Button>
            <Button
              type="button"
              onClick={() => {
                onChange(sel);
                setOpen(false);
              }}
            >
              Use selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
