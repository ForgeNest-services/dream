import { Button } from "@/components/ui/button";
import { downloadReportExport } from "@/lib/report-export";
import { Download, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/** Export XLSX/PDF buttons shared by every report page — always exports ALL
 *  rows matching the current filters (server-side, unpaginated), not just
 *  what's on screen. `params` should be the same filter object the page's
 *  list query uses. */
export function ExportButtons({
  path,
  params,
}: {
  path: string;
  params: Record<string, string | undefined>;
}) {
  const [busy, setBusy] = useState<"xlsx" | "pdf" | null>(null);

  const run = async (format: "xlsx" | "pdf") => {
    setBusy(format);
    try {
      const res = await downloadReportExport(path, params, format);
      if (!res.ok) toast.error(res.error ?? "Export failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void run("xlsx")}>
        <Download className="mr-1.5 h-4 w-4" /> {busy === "xlsx" ? "Exporting…" : "XLSX"}
      </Button>
      <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void run("pdf")}>
        <FileText className="mr-1.5 h-4 w-4" /> {busy === "pdf" ? "Exporting…" : "PDF"}
      </Button>
    </>
  );
}
