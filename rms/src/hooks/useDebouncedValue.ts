import { useEffect, useState } from "react";

/**
 * Debounce a value. Returns the input value only after it has been stable
 * for `delay` ms. Used to avoid firing an API call on every keystroke of a
 * search input.
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
