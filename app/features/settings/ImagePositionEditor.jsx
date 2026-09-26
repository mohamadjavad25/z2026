"use client";

import { useRef, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { ProfileSheet } from "../profile/ProfileSheet";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parsePosition(position) {
  const match = /^(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%$/.exec(String(position || "").trim());
  if (!match) return { x: 50, y: 50 };
  return { x: clamp(Number(match[1]), 0, 100), y: clamp(Number(match[2]), 0, 100) };
}

/**
 * Drag-to-focus crop picker for the avatar (circle) and poster (wide
 * banner) — the frame here matches the real on-screen aspect ratio
 * (1:1 for the avatar, ~343:248 for the poster band), so wherever the
 * user drags the focal point to is exactly where it lands in the app,
 * no separate "preview" that can drift from the real thing.
 */
export function ImagePositionEditor({ open, shape, image, position, busy = false, onSave, onClose }) {
  const [pos, setPos] = useState(() => parsePosition(position));
  const [dragging, setDragging] = useState(false);
  const frameRef = useRef(null);

  if (!open) return null;

  function updateFromEvent(event) {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return;
    const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);
    setPos({ x, y });
  }

  function handlePointerDown(event) {
    event.preventDefault();
    frameRef.current?.setPointerCapture?.(event.pointerId);
    setDragging(true);
    updateFromEvent(event);
  }

  function handlePointerMove(event) {
    if (!dragging) return;
    updateFromEvent(event);
  }

  function stopDragging() {
    setDragging(false);
  }

  const positionValue = `${pos.x.toFixed(1)}% ${pos.y.toFixed(1)}%`;

  return (
    <ProfileSheet
      open={open}
      kicker="تنظیم تصویر"
      title={shape === "circle" ? "موقعیت لوگو" : "موقعیت پوستر"}
      label="تنظیم موقعیت تصویر"
      panelClassName="imagePositionSheet"
      onClose={onClose}
    >
      <p className="imagePositionHint">بکشید تا قسمتی از عکس که می‌خواهید نمایش داده شود را انتخاب کنید.</p>
      <div
        ref={frameRef}
        className={`imagePositionFrame is-${shape}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerLeave={stopDragging}
        onPointerCancel={stopDragging}
      >
        <img
          src={image}
          alt=""
          draggable={false}
          style={{ objectPosition: positionValue }}
        />
        <span className="imagePositionCrosshair" style={{ left: `${pos.x}%`, top: `${pos.y}%` }} aria-hidden="true" />
      </div>
      <div className="imagePositionActions">
        <button type="button" className="imagePositionReset" onClick={() => setPos({ x: 50, y: 50 })}>
          <RotateCcw size={14} aria-hidden="true" />
          بازگشت به مرکز
        </button>
        <button
          type="button"
          className="imagePositionSave"
          disabled={busy}
          onClick={() => onSave(positionValue)}
        >
          <Check size={14} aria-hidden="true" />
          {busy ? "..." : "ذخیره"}
        </button>
      </div>
    </ProfileSheet>
  );
}
