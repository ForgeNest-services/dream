import { Button } from "@/components/ui/button";
import { useApp } from "@/context/app-store";
import { ImagePlus, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

// One-off image upload (payment QR, etc.) — no Media Center browsing, just
// pick a file and it's live. Still goes through addMedia so the file lands
// in real storage with a real URL; it just skips the reuse-existing-image
// picker dialog, which only makes sense for images meant to be reused.
export function DirectImageUpload({
  imageUrl,
  onChange,
  label = "Upload image",
  folder = "Uploads",
}: {
  imageUrl: string | undefined;
  onChange: (url: string | undefined) => void;
  label?: string;
  folder?: string;
}) {
  const app = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const res = await app.addMedia(file, folder);
      if (!res.ok || !res.media) {
        toast.error(res.error ?? "Upload failed");
        return;
      }
      onChange(res.media.url);
      toast.success("Image uploaded");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
      >
        {imageUrl ? <Upload className="mr-2 h-4 w-4" /> : <ImagePlus className="mr-2 h-4 w-4" />}
        {uploading ? "Uploading…" : imageUrl ? "Replace" : label}
      </Button>
      {imageUrl && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => onChange(undefined)}
        >
          <X className="mr-1.5 h-3.5 w-3.5" /> Remove
        </Button>
      )}
    </div>
  );
}
