import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { forwardRef, useEffect, useState } from "react";

/** type="number" input that selects its full value on focus, so typing
 *  immediately overwrites the default "0" instead of appending to it. */
export const NumericInput = forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<typeof Input>, "type" | "onFocus"> & {
    onFocus?: React.FocusEventHandler<HTMLInputElement>;
  }
>(({ className, onFocus, ...props }, ref) => (
  <Input
    type="number"
    className={cn("num", className)}
    onFocus={(e) => {
      e.target.select();
      onFocus?.(e);
    }}
    ref={ref}
    {...props}
  />
));
NumericInput.displayName = "NumericInput";

/** Decimal-value input rendered as type="text" — avoids the browser's
 *  built-in number-input quirks (stuck cursor mid-typing a decimal, no
 *  free-form backspacing, spinner arrows) while still only accepting a
 *  valid decimal as the user types. inputMode="decimal" still shows a
 *  numeric keypad on mobile. Selects its full value on focus, matching
 *  NumericInput. Value/onChange work in plain numbers — the string editing
 *  state lives inside the component. */
export function DecimalTextInput({
  value,
  onChange,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange"> & {
  value: number;
  onChange: (value: number) => void;
}) {
  // Raw typed text is kept locally so a trailing "." or "113.40" (with the
  // trailing zero) isn't silently normalized away mid-keystroke by
  // round-tripping through Number() on every render — only the parsed
  // number is reported upward via onChange.
  const [text, setText] = useState(() => (Number.isFinite(value) ? String(value) : ""));

  useEffect(() => {
    // Resync when the value changes from outside (e.g. the linked Exc./Inc.
    // VAT field, or loading a different variant) — but not while the parsed
    // text already matches, so we don't fight the user's in-progress typing
    // (e.g. a trailing "." that Number() would otherwise erase).
    if (Number(text) !== value) setText(Number.isFinite(value) ? String(value) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Input
      type="text"
      inputMode="decimal"
      className={cn("num", className)}
      value={text}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
        setText(raw);
        onChange(raw === "" || raw === "." ? 0 : Number(raw));
      }}
      {...props}
    />
  );
}
