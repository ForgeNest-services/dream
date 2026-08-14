import { code128b } from "@/lib/barcode";
import { cn } from "@/lib/utils";

export function Barcode({
  value,
  height = 44,
  moduleWidth = 1.6,
  showValue = true,
  className,
}: {
  value: string;
  height?: number;
  moduleWidth?: number;
  showValue?: boolean;
  className?: string;
}) {
  const modules = code128b(value);
  if (!modules) return null;
  const width = modules.length * moduleWidth;
  const bars: { x: number; w: number }[] = [];
  let i = 0;
  while (i < modules.length) {
    if (modules[i] === "1") {
      let run = 1;
      while (modules[i + run] === "1") run++;
      bars.push({ x: i * moduleWidth, w: run * moduleWidth });
      i += run;
    } else i++;
  }
  return (
    <div className={cn("inline-flex flex-col items-center gap-1", className)}>
      <svg
        role="img"
        aria-label={`Barcode ${value}`}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="max-w-full"
      >
        <rect width={width} height={height} fill="#fff" />
        {bars.map((b, idx) => (
          <rect key={idx} x={b.x} y={0} width={b.w} height={height} fill="#000" />
        ))}
      </svg>
      {showValue && (
        <span className="num text-[10px] tracking-[0.18em] text-black">{value}</span>
      )}
    </div>
  );
}
