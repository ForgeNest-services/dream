import { authStorage } from "./auth-storage";

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "https://api.srotaapps.com/api";

/** Downloads a report export — the endpoint requires auth, so this can't be
 *  a plain <a href> link (no way to attach the Authorization header). Fetches
 *  the file as a blob and triggers a save via a temporary object URL, same
 *  technique as lib/csv.ts's downloadCsv. */
export async function downloadReportExport(
  path: string,
  params: Record<string, string | undefined>,
  format: "xlsx" | "pdf",
): Promise<{ ok: boolean; error?: string }> {
  const qs = new URLSearchParams();
  qs.set("format", format);
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const token = authStorage.getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_URL}${path}?${qs.toString()}`, { headers });
    if (!res.ok) {
      return { ok: false, error: `Export failed (${res.status})` };
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const match = /filename="([^"]+)"/.exec(disposition);
    const filename = match?.[1] ?? `report.${format}`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch {
    return { ok: false, error: "Export failed" };
  }
}
