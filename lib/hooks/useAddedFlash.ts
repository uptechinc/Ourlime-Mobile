import { useCallback, useEffect, useRef, useState } from 'react';

/** How long an "Added" button keeps its confirmation before it reads "Add to cart" again. */
export const ADDED_FLASH_MS = 1800;

/**
 * A short-lived "done" state for a button that just worked ("Added ✓"): `flash()` turns it on, and it turns itself
 * off after `durationMs`. A second flash restarts the timer.
 */
export function useAddedFlash(durationMs: number = ADDED_FLASH_MS): { isFlashing: boolean; flash: () => void } {
  const [isFlashing, setIsFlashing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const flash = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setIsFlashing(true);
    timer.current = setTimeout(() => { timer.current = null; setIsFlashing(false); }, durationMs);
  }, [durationMs]);
  return { isFlashing, flash };
}
