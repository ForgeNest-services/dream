import { Button } from "@/components/ui/button";
import { useApp } from "@/context/app-store";
import { ImagePlus, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

// One-shot payment QR uploader — deliberately separate from MediaPicker /
// the Media Center: a branch's QR code isn't a reusable product asset, so
// it must never land in that library. Uploads via the generic /uploads
// endpoint (app.uploadQrImage) and saves straight to the current branch's
// settings row — no local draft state, the change is live immediately.
export function PaymentQrUploader() {
  const app = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const res = await app.uploadQrImage(file);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to upload QR image");
        return;
      }
      toast.success("Payment QR updated");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const res = await app.clearQrImage();
      if (!res.ok) {
        toast.error(res.error ?? "Failed to remove QR image");
        return;
      }
      toast.success("QR removed");
    } finally {
      setBusy(false);
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
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        {app.company.qrImageUrl ? (
          <Upload className="mr-2 h-4 w-4" />
        ) : (
          <ImagePlus className="mr-2 h-4 w-4" />
        )}
        {busy ? "Uploading…" : app.company.qrImageUrl ? "Replace" : "Upload QR"}
      </Button>
      {app.company.qrImageUrl && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          disabled={busy}
          onClick={() => void remove()}
        >
          <X className="mr-1.5 h-3.5 w-3.5" /> Remove
        </Button>
      )}
    </div>
  );
}
