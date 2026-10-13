import { useEffect, useRef } from "react";
import { BACK_PRIORITY, registerBackHandler } from "../lib/backStack";

/**
 * While `active`, the phone's back button calls `onBack` instead of leaving the
 * app (see app/shared/lib/backStack.js). `onBack` may return false to stay open.
 */
export function useBackHandler(active, onBack, priority = BACK_PRIORITY.overlay) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!active) return undefined;
    return registerBackHandler(() => onBackRef.current?.(), priority);
  }, [active, priority]);
}
