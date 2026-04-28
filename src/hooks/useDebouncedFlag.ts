import { useEffect, useState } from 'react';

/**
 * Returns a boolean that mirrors `value`, but only flips `false → true` after
 * `value` has stayed truthy for at least `ms` milliseconds. Transitions back
 * to `false` are immediate so consumers can hide UI without delay.
 *
 * Used by the loading overlay (requirements §7.1) so quick generations don't
 * flash an overlay onscreen.
 */
export function useDebouncedFlag(value: boolean, ms: number): boolean {
  const [debounced, setDebounced] = useState(false);

  useEffect(() => {
    if (!value) {
      setDebounced(false);
      return;
    }
    const id = window.setTimeout(() => setDebounced(true), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);

  return debounced;
}
