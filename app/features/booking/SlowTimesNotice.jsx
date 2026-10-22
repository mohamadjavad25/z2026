"use client";

import { useEffect, useRef, useState } from "react";

export const SLOW_AFTER_MS = 3000;
export const BUSY_AFTER_MS = 10000;
export const SLOW_TEXT = "ساعت‌ها دیر می‌آیند؛ دارم دوباره امتحان می‌کنم";
export const BUSY_TEXT = "الان شلوغ است. چند لحظهٔ دیگر";

/** 0 = nothing to say yet, 1 = slow (after 3 s), 2 = busy (after 10 s). */
export function slowLevel(elapsedMs) {
  if (elapsedMs >= BUSY_AFTER_MS) return 2;
  if (elapsedMs >= SLOW_AFTER_MS) return 1;
  return 0;
}

/**
 * Shown under «در حال پیدا کردن ساعت‌ها» while the times are still on their way (a rush, a slow line): after 3 s it
 * says so and asks again once by itself, with «دوباره» for the client to ask now; after 10 s it says the salon's
 * page is busy. Mount it only while loading (it counts from mount); `onRetry` asks the server again.
 */
export function SlowTimesNotice({ onRetry }) {
  const [level, setLevel] = useState(0);
  const retryRef = useRef(onRetry);
  retryRef.current = onRetry;
  useEffect(() => {
    const slow = setTimeout(() => { setLevel(1); retryRef.current?.(); }, SLOW_AFTER_MS);
    const busy = setTimeout(() => setLevel(2), BUSY_AFTER_MS);
    return () => { clearTimeout(slow); clearTimeout(busy); };
  }, []);
  if (!level) return null;
  return (
    <div className="vbInfo vbAhead" role="status">
      <span>{level === 2 ? BUSY_TEXT : SLOW_TEXT}</span>
      <button type="button" className="vbAction" onClick={() => retryRef.current?.()}>دوباره</button>
    </div>
  );
}
