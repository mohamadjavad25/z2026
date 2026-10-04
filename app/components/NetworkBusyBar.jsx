"use client";

import { useEffect, useState } from "react";
import { subscribeBusy } from "../shared/api/busyTracker";

/**
 * Thin progress bar at the top of the screen while any save/update request is in
 * flight. Appears only after a short delay so instant requests never flicker.
 * Placeholder visual -- to be replaced by the branded loader later.
 */
export function NetworkBusyBar() {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let timer = 0;
    const unsubscribe = subscribeBusy((count) => {
      window.clearTimeout(timer);
      if (count > 0) timer = window.setTimeout(() => setBusy(true), 180);
      else setBusy(false);
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  if (!busy) return null;
  return (
    <div className="networkBusyBar" role="progressbar" aria-label="در حال ذخیره" aria-busy="true">
      <i />
    </div>
  );
}
