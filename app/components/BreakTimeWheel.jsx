"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SegmentClock } from "./SegmentClock";

export const BREAK_WHEEL_ITEM = 52;

function normalizeVisibleCount(count) {
  const raw = Math.max(3, Number(count) || 3);
  return raw % 2 === 0 ? raw + 1 : raw;
}

export function BreakTimeWheel({
  options = [],
  value,
  onChange,
  ariaLabel = "انتخاب ساعت",
  disabledValues = [],
  visibleCount = 3,
  mode = "clock",
  idPrefix = "break-wheel",
  // Canonical look for every hour/day wheel in the app -- the working-hours
  // editor (SalonHoursEditor) is the reference; every other usage (booking
  // creation, the artist break-time editor) used to override these with
  // its own one-off colors, so the exact same control read as three
  // visually different pickers depending on where you ran into it. Now
  // it's one look, defined once, here.
  activeColor = "#24143f",
  inactiveColor = "rgba(36, 20, 63, 0.26)",
  disabledColor = "rgba(36, 20, 63, 0.12)",
  itemSize = BREAK_WHEEL_ITEM,
  clockSize = "xs"
}) {
  const railRef = useRef(null);
  const settleTimer = useRef(0);
  const syncLock = useRef(false);
  const [visualIndex, setVisualIndex] = useState(0);

  const rows = normalizeVisibleCount(visibleCount);
  const sidePad = Math.floor((rows - 1) / 2);
  const enabledOptions = options.filter((slot) => !disabledValues.includes(slot));
  const activeValue = enabledOptions.includes(value)
    ? value
    : (enabledOptions[0] || value || "");

  function indexOfValue(slot) {
    const index = options.indexOf(slot);
    return index >= 0 ? index : 0;
  }

  function nearestEnabledIndex(rawIndex) {
    let index = Math.max(0, Math.min(options.length - 1, Math.round(rawIndex)));
    if (!disabledValues.includes(options[index])) return index;

    for (let offset = 1; offset < options.length; offset += 1) {
      const up = index + offset;
      const down = index - offset;
      if (up < options.length && !disabledValues.includes(options[up])) return up;
      if (down >= 0 && !disabledValues.includes(options[down])) return down;
    }
    return index;
  }

  function scrollToIndex(index, behavior = "auto") {
    const rail = railRef.current;
    if (!rail) return;
    const maxIndex = Math.max(0, options.length - 1);
    const nextIndex = Math.max(0, Math.min(maxIndex, index));
    syncLock.current = true;
    rail.scrollTo({ top: nextIndex * itemSize, behavior });
    window.setTimeout(() => {
      syncLock.current = false;
    }, behavior === "smooth" ? 240 : 40);
  }

  useLayoutEffect(() => {
    if (!options.length) return;
    const index = indexOfValue(activeValue);
    setVisualIndex(index);
    scrollToIndex(index, "auto");
  }, [activeValue, options.join("|"), rows, itemSize]);

  function settleFromScroll() {
    const rail = railRef.current;
    if (!rail || !options.length) return;
    const rawIndex = rail.scrollTop / itemSize;
    const index = nearestEnabledIndex(rawIndex);
    const next = options[index];
    setVisualIndex(index);
    scrollToIndex(index, "smooth");
    if (next && next !== value) onChange?.(next);
  }

  function handleScroll() {
    const rail = railRef.current;
    if (!rail) return;
    const liveIndex = Math.round(rail.scrollTop / itemSize);
    setVisualIndex(Math.max(0, Math.min(options.length - 1, liveIndex)));
    if (syncLock.current) return;
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(settleFromScroll, 90);
  }

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  // Roving-tabindex keyboard nav -- only the active option is tab-stoppable
  // (below), so arrow keys are the only way to move between options once
  // focused. Previously this listbox had none at all: a keyboard user could
  // Tab to the active option and nowhere else, with no way to change it
  // without a pointer/touch scroll gesture.
  function focusOption(slot) {
    const el = railRef.current?.querySelector(`#${CSS.escape(`${idPrefix}-${slot}`)}`);
    el?.focus();
  }

  function moveSelection(fromIndex, step) {
    if (!options.length) return;
    let index = fromIndex;
    for (let guard = 0; guard < options.length; guard += 1) {
      index += step;
      if (index < 0 || index > options.length - 1) return;
      if (!disabledValues.includes(options[index])) break;
    }
    index = Math.max(0, Math.min(options.length - 1, index));
    if (disabledValues.includes(options[index])) return;
    setVisualIndex(index);
    scrollToIndex(index, "smooth");
    const next = options[index];
    if (next && next !== value) onChange?.(next);
    focusOption(next);
  }

  function handleItemKeyDown(event, index) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection(index, 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(index, -1);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveSelection(-1, 1);
    } else if (event.key === "End") {
      event.preventDefault();
      moveSelection(options.length, -1);
    }
  }

  return (
    <div
      className={`breakTimeWheel ${mode === "label" ? "is-label" : "is-clock"}`}
      aria-label={ariaLabel}
      role="listbox"
      aria-activedescendant={activeValue ? `${idPrefix}-${activeValue}` : undefined}
      style={{
        "--break-wheel-item": `${itemSize}px`,
        "--break-wheel-visible": String(rows),
        "--break-wheel-side": String(sidePad)
      }}
    >
      <div className="breakTimeWheelMask breakTimeWheelMaskTop" aria-hidden="true" />
      <div className="breakTimeWheelMask breakTimeWheelMaskBottom" aria-hidden="true" />
      <div className="breakTimeWheelFocus" aria-hidden="true" />
      <div
        ref={railRef}
        className="breakTimeWheelRail"
        onScroll={handleScroll}
      >
        <div className="breakTimeWheelPad" aria-hidden="true" />
        {options.map((slot, index) => {
          const disabled = disabledValues.includes(slot);
          const distance = Math.abs(index - visualIndex);
          const active = index === visualIndex;
          return (
            <button
              type="button"
              id={`${idPrefix}-${slot}`}
              role="option"
              key={slot}
              tabIndex={active ? 0 : -1}
              aria-selected={active}
              disabled={disabled}
              className={`breakTimeWheelItem ${mode === "clock" ? "withSegmentClock" : "is-text"} ${active ? "is-active" : ""} ${disabled ? "is-disabled" : ""}`}
              style={{ "--wheel-distance": String(distance) }}
              onClick={() => {
                if (disabled) return;
                setVisualIndex(index);
                scrollToIndex(index, "smooth");
                onChange?.(slot);
              }}
              onKeyDown={(event) => handleItemKeyDown(event, index)}
            >
              {mode === "clock" ? (
                <SegmentClock
                  value={slot}
                  size={clockSize}
                  as="span"
                  backgroundColor="transparent"
                  color={active ? activeColor : disabled ? disabledColor : inactiveColor}
                />
              ) : (
                <span
                  className="breakTimeWheelLabel"
                  style={{
                    color: active ? activeColor : disabled ? disabledColor : inactiveColor
                  }}
                >
                  {slot}
                </span>
              )}
            </button>
          );
        })}
        <div className="breakTimeWheelPad" aria-hidden="true" />
      </div>
    </div>
  );
}
