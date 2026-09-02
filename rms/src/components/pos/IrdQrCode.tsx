import { useEffect, useRef } from "react";
import QRCode from "qrcode";

/**
 * Renders a Dynamic QR code per Electronic Billing Procedure 2082, clause
 * 6.2(ङ). Generated entirely client-side (no third-party QR API) since the
 * payload carries PAN + bill totals — never sent to an external service.
 */
export function IrdQrCode({ data, size = 96 }: { data: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    // margin must be >=1 — a QR needs a blank "quiet zone" border for a
    // camera to find its finder patterns at all (margin:0 was confirmed
    // unscannable). toCanvas sets canvas.style.width/height itself to
    // match `width` below — set explicitly to `size` (not a multiple of
    // it) so the rendered size is exactly what the caller asked for; a
    // prior attempt rendered 4x then tried to scale down via a separate
    // inline style, but toCanvas's own style write runs after and wins,
    // producing an oversized, unscaled QR.
    QRCode.toCanvas(ref.current, data, { width: size, margin: 3 }).catch(() => {
      // Non-fatal — a failed render just leaves a blank canvas, the rest
      // of the bill still prints and stays legally valid without it.
    });
  }, [data, size]);

  return <canvas ref={ref} />;
}
