import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Printable menu-QR poster.
 *
 * Why a portal + JS-injected @page: the thermal print CSS in styles.css
 * sets `@page { size: 72mm auto }` for receipt printing. `@page` is a
 * document-level at-rule — it can't be scoped via a class — so a QR print
 * on the same page would inherit the 72mm width and clip the poster. We
 * inject an A4 `@page` right before printing (later in the cascade → wins)
 * and remove it after.
 *
 * The portal also lives outside any transformed ancestor (Radix Dialog),
 * so `position: absolute; inset: 0` places the poster correctly on the
 * sheet — same trick we use for the bill/KOT.
 */
export function MenuQrPrintButton({
  menuUrl,
  branchName,
}: {
  menuUrl: string;
  branchName: string;
}) {
  const [printing, setPrinting] = useState(false);
  // Larger QR for a print-worthy poster. The 240×240 shown on-screen in
  // Settings is tiny by comparison — we regenerate at 600×600 for print.
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(
    menuUrl,
  )}`;

  useEffect(() => {
    if (!printing) return;
    document.body.classList.add("printing-menu-qr");

    // Inject an A4 @page that overrides the thermal one from styles.css.
    // Added last in the head so it wins the cascade for this print job.
    const style = document.createElement("style");
    style.setAttribute("data-menu-qr-print", "");
    style.textContent = `@media print { @page { size: A4 portrait; margin: 15mm; } }`;
    document.head.appendChild(style);

    const cleanup = () => {
      document.body.classList.remove("printing-menu-qr");
      if (style.parentNode) style.parentNode.removeChild(style);
      setPrinting(false);
    };
    window.addEventListener("afterprint", cleanup);

    // Give React one frame to mount the portal + the QR image time to
    // decode from the qrserver.com response. If the image hasn't painted
    // by print time you get a blank square. 400ms is generous but safe.
    const timer = window.setTimeout(() => window.print(), 400);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", cleanup);
      // Belt-and-suspenders: if the effect re-runs mid-print (unmount),
      // still clean up the style + class so we don't leak state.
      document.body.classList.remove("printing-menu-qr");
      if (style.parentNode) style.parentNode.removeChild(style);
    };
  }, [printing]);

  return (
    <>
      <Button
        variant="outline"
        className="h-11"
        onClick={() => setPrinting(true)}
        disabled={printing}
      >
        <Printer className="size-4" />
        {printing ? "Preparing…" : "Print QR"}
      </Button>
      {printing && typeof document !== "undefined"
        ? createPortal(
            <div id="menu-qr-print-area">
              <div className="menu-qr-poster">
                <p className="menu-qr-brand">Srota RMS</p>
                <h1 className="menu-qr-branch">{branchName}</h1>
                <p className="menu-qr-cta">Scan to view our menu</p>
                <img
                  src={qrUrl}
                  alt={`Menu QR for ${branchName}`}
                  className="menu-qr-image"
                />
                <p className="menu-qr-url">{menuUrl}</p>
                <p className="menu-qr-footnote">
                  View-only menu · please order with our staff
                </p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
