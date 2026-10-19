"use client";

import { useEffect, useState } from "react";

// Set once a salon/artist has seen the tip, so it shows a single time per device.
const SEEN_KEY = "frfro-tip-create-booking";

function hasSeen() {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
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
export function CreateBookingTip({ active, onCreateBooking }) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    if (!active || hasSeen()) return undefined;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setRect(findButtonRect()));
    };
    // Let the profile and the bar settle first, so the hole lands on the button.
    const timer = window.setTimeout(measure, 900);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
    };
  }, [active]);

  if (!active || !rect) return null;

  const close = () => {
    rememberSeen();
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
        aria-label="ایجاد رزرو جدید"
      />
      <div className="createTipCard" style={{ bottom: above + 18 }}>
        <strong id="createTipTitle">رزرو جدید از همین دکمه</strong>
        <p>مشتری تلفنی یا حضوری وقت خواست؟ این + رو بزن و خودت براش نوبت ثبت کن.</p>
        <button type="button" className="createTipOk" onClick={close}>
          فهمیدم
        </button>
      </div>
      <i className="createTipArrow" style={{ left: centerX, bottom: above + 11 }} aria-hidden="true" />
    </div>
  );
}
