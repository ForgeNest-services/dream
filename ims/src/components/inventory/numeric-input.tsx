import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { forwardRef, useEffect, useRef, useState } from "react";

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
  // Tracks focus so the resync effect below can skip itself while the user
  // is actively in this field — see that effect for why.
  const focused = useRef(false);

  useEffect(() => {
    // Resync when the value changes from outside (e.g. the linked Exc./Inc.
    // VAT field, or loading a different variant) — but never while this
    // field itself is focused. A linked Exc./Inc. VAT pair round-trips a
    // typed value through a 2-decimal-place STORED intermediate (the other
    // field), which is lossy by up to a full cent (e.g. typing 5 into
    // Inc.VAT at 13% stores Exc.VAT as 4.42, which converts back to 4.99,
    // not 5) — not just float noise, so the 2dp-comparison guard alone
    // can't tell "the user's own edit came back rounded" from "a genuinely
    // different value arrived from outside" and would stomp the digits the
    // user is still typing. Deferring any resync until blur sidesteps this:
    // the field shows exactly what was typed while focused, and only snaps
    // to the true persisted (rounded) value once the user leaves it.
    if (focused.current) return;
    const roundedText = Math.round(Number(text) * 100) / 100;
    const roundedValue = Math.round(value * 100) / 100;
    if (roundedText !== roundedValue) {
      setText(Number.isFinite(value) ? String(roundedValue) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Input
      type="text"
      inputMode="decimal"
      className={cn("num", className)}
      value={text}
      onFocus={(e) => {
        focused.current = true;
        e.target.select();
      }}
      onBlur={() => {
        focused.current = false;
        // Snap to the true rounded value now that editing has ended, in
        // case the last keystroke's round-trip landed a cent off from what
        // was displayed while focused (see the effect above).
        const rounded = Math.round(value * 100) / 100;
        setText(Number.isFinite(value) ? String(rounded) : "");
      }}
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
