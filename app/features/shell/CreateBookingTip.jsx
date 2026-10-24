"use client";

import { useEffect, useRef, useState } from "react";

// Set once a salon/artist's account has been shown the tip: one time per account on this device.
const SEEN_KEY = "frfro-tip-create-booking";

function seenKey(accountId) {
  return `${SEEN_KEY}:${accountId}`;
}

function hasSeen(accountId) {
  try {
    return window.localStorage.getItem(seenKey(accountId)) === "1";
  } catch {
    return false;
  }
}

function rememberSeen(accountId) {
  try {
    window.localStorage.setItem(seenKey(accountId), "1");
  } catch {
    // Private window or blocked storage: the tip just shows again next time.
  }
}

function findButtonRect() {
  const button = document.querySelector(".bottomNav .is-createBooking");
  return button ? button.getBoundingClientRect() : null;
}

/**
 * A one-time spotlight on the bottom bar's «+» for a salon/artist new to the app:
 * everything else is dimmed and a short note says what it is for (testers thought
 * only clients could book, through the salon's link). Tapping the «+» itself also
 * closes it and opens the booking sheet.
 */
export function CreateBookingTip({ active, accountId, onCreateBooking }) {
  const [rect, setRect] = useState(null);
  // Set once the tip is closed, so a later resize can never bring it back: phones fire "resize"
  // whenever the address bar or keyboard moves, which used to re-open the tip after every dismissal.
  const closedRef = useRef(false);

  useEffect(() => {
    if (!active || !accountId || hasSeen(accountId)) return undefined;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (closedRef.current) return;
        const next = findButtonRect();
        // Counted as seen as soon as it is shown, so a reload or an app restart does not show it again.
        if (next) rememberSeen(accountId);
        setRect(next);
      });
    };
    // Let the profile and the bar settle first, so the hole lands on the button.
    const timer = window.setTimeout(measure, 900);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
    };
  }, [active, accountId]);

  if (!active || !rect) return null;

  const close = () => {
    closedRef.current = true;
    setRect(null);
  };
  const pad = 8;
  const size = Math.max(rect.width, rect.height) + pad * 2;
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const above = window.innerHeight - centerY + size / 2;

  return (
    <div className="createTip" role="dialog" aria-modal="true" aria-labelledby="createTipTitle">
      <button
        type="button"
        className="createTipHole"
        style={{ width: size, height: size, left: centerX - size / 2, top: centerY - size / 2 }}
        onClick={() => {
          close();
          onCreateBooking?.();
        }}
        aria-label="نوبت تازه"
      />
      <div className="createTipCard" style={{ bottom: above + 18 }}>
        <strong id="createTipTitle">نوبت تازه از همین دکمه</strong>
        <p>مشتری تلفنی یا حضوری وقت خواست؟ این + رو بزن و خودت براش نوبت ثبت کن.</p>
        <button type="button" className="createTipOk" onClick={close}>
          فهمیدم
        </button>
      </div>
      <i className="createTipArrow" style={{ left: centerX, bottom: above + 11 }} aria-hidden="true" />
    </div>
  );
}
