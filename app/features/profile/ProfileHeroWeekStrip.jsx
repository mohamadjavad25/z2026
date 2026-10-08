"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, Check } from "lucide-react";

const WEEK_STRIP_SETTLE_MS = 140;

// Memoized so that a scroll-driven highlight change (liveDay flipping
// between two cells, dozens of times a second while dragging) only
// re-renders the cells whose own `isActive` actually changed, instead of
// every cell in a strip that can hold a whole rolling year of days. The
// ref-callback and click handler are wrapped in useCallback keyed to values
// that never change for an already-mounted cell (item.day/itemValue), so
// they stay referentially stable across parent re-renders and don't defeat
// the memo below.
const WeekDayCell = memo(function WeekDayCell({ item, itemValue, itemLabel, isActive, onRegisterNode, onDayClick }) {
  const refCallback = useCallback((node) => onRegisterNode(item.day, node), [item.day, onRegisterNode]);
  const clickHandler = useCallback(() => onDayClick(itemValue), [itemValue, onDayClick]);

  return (
    <button
      type="button"
      ref={refCallback}
      className={[
        "salonHeroWeekDay",
        isActive ? "is-active" : "",
        item.isToday ? "is-today" : "",
        item.off ? "is-off" : ""
      ].filter(Boolean).join(" ")}
      aria-current={item.isToday ? "date" : undefined}
      onClick={clickHandler}
    >
      <span>{itemLabel}</span>
      <small>{item.meta}</small>
      {item.isToday ? (
        <b><Check size={13} /></b>
      ) : (
        <em>{item.state}</em>
      )}
    </button>
  );
});

/**
 * Horizontally-scrollable, center-snapping day strip: click (or scroll/drag)
 * any day to bring it to the middle and commit it as the selection. Shared
 * across every profile-hero variant that needs a "which day am I looking
 * at" picker — salon and artist heroes, plus the client booking-date rail
 * (see styles.css for each host's card styling; this component only owns
 * behavior + the bare `salonHeroWeek*` class names).
 */
export function ProfileHeroWeekStrip({
  items = [],
  selectedDay = "",
  defaultDay = "",
  onSelectDay,
  onOpenHistory,
  ariaLabel = "انتخاب روز برنامه"
}) {
  const activeDay = selectedDay || defaultDay || items[0]?.day || "";
  const scrollerRef = useRef(null);
  const dayNodesRef = useRef(new Map());
  const settleTimerRef = useRef(null);
  const centerFrameRef = useRef(null);
  const programmaticScrollRef = useRef(false);
  const programmaticResetRef = useRef(null);
  // Ordered list of day keys (mirrors `items`, kept fresh every render — a
  // plain array assignment is far cheaper than the geometry reads below, so
  // there's no need to memoize it). Lets getCenteredDay() below walk
  // neighbors instead of rescanning every cell in the strip: with the salon
  // hero variant rendering a whole rolling year (~180-700 cells), scanning
  // all of them via getBoundingClientRect() on every scroll animation frame
  // was the actual source of the janky/laggy centering.
  const orderedDaysRef = useRef([]);
  orderedDaysRef.current = items.map((item) => item.day);
  const lastCenterIndexRef = useRef(0);
  // Native overflow-x:auto already gives touch/trackpad swipe for free, but
  // a plain mouse has no built-in way to "drag" a div — there's no
  // scrollbar shown and vertical wheel doesn't map to it. This adds
  // click-and-drag scrolling for mouse pointers specifically; touch/pen
  // pointers are left alone since they already work natively.
  const dragRef = useRef({ down: false, startX: 0, startScrollLeft: 0, moved: false });
  const userInteractedRef = useRef(false);

  // The highlighted "box" tracks whichever day is currently centered —
  // live, while scrolling/dragging — separately from `activeDay` (the
  // committed prop from the parent). They're kept in sync by the effect
  // below; this local copy is what lets the box follow the middle smoothly
  // instead of jumping only once a scroll settles.
  const [liveDay, setLiveDay] = useState(activeDay);

  const registerDayNode = useCallback((day, node) => {
    if (node) dayNodesRef.current.set(day, node);
    else dayNodesRef.current.delete(day);
  }, []);

  // Distance from a cell (by its index in orderedDaysRef) to the scroller's
  // center. Cells sit in a single row in `items` order, so this distance is
  // unimodal in `index` — it only decreases then increases — which is what
  // lets the hill-climb below find the minimum without checking every cell.
  function distanceAtIndex(index, centerX) {
    const day = orderedDaysRef.current[index];
    const node = day != null ? dayNodesRef.current.get(day) : null;
    if (!node) return Infinity;
    const nodeRect = node.getBoundingClientRect();
    return Math.abs(nodeRect.left + nodeRect.width / 2 - centerX);
  }

  function getCenteredDay() {
    const scroller = scrollerRef.current;
    const order = orderedDaysRef.current;
    if (!scroller || order.length === 0) return null;
    const rect = scroller.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;

    // Start from the last known centered index (scroll only ever moves the
    // center by a handful of cells between animation frames) and walk
    // toward whichever neighbor is closer, one step at a time, stopping at
    // the local (= global, since the row is unimodal) minimum. Falls back
    // to a full scan only the first time, when there's no prior index yet.
    let idx = Math.min(Math.max(lastCenterIndexRef.current, 0), order.length - 1);
    let dist = distanceAtIndex(idx, centerX);

    while (idx < order.length - 1) {
      const next = distanceAtIndex(idx + 1, centerX);
      if (next >= dist) break;
      idx += 1;
      dist = next;
    }
    while (idx > 0) {
      const prev = distanceAtIndex(idx - 1, centerX);
      if (prev >= dist) break;
      idx -= 1;
      dist = prev;
    }

    lastCenterIndexRef.current = idx;
    return order[idx] ?? null;
  }

  function handlePointerDown(event) {
    if (event.pointerType !== "mouse") return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    dragRef.current = {
      down: true,
      startX: event.clientX,
      startScrollLeft: scroller.scrollLeft,
      moved: false,
      pointerId: event.pointerId
    };
    // Pointer capture is claimed lazily, only once real dragging is
    // confirmed in handlePointerMove below — NOT here on every mousedown.
    // Capturing immediately (even for what turns out to be a plain click)
    // can redirect the matching mouseup/click away from the day button the
    // press actually started on, silently swallowing normal clicks. Until
    // that happens the button underneath handles its own click as usual.
  }

  function handlePointerMove(event) {
    if (event.pointerType !== "mouse") return;
    const state = dragRef.current;
    const scroller = scrollerRef.current;
    if (!state.down || !scroller) return;
    const dx = event.clientX - state.startX;
    if (!state.moved && Math.abs(dx) > 4) {
      state.moved = true;
      scroller.setPointerCapture?.(state.pointerId);
    }
    if (state.moved) {
      scroller.scrollLeft = state.startScrollLeft - dx;
    }
  }

  function endDrag(event) {
    if (event.pointerType && event.pointerType !== "mouse") return;
    const state = dragRef.current;
    if (state.moved && scrollerRef.current) {
      try { scrollerRef.current.releasePointerCapture?.(event.pointerId); } catch { /* noop */ }
    }
    state.down = false;
    // The click that follows a real drag (browser fires pointerup then
    // click for the same gesture, synchronously) needs to see `moved` still
    // true so handleDayClick can swallow it. But if the drag ends over
    // empty space — no button, no click ever follows — nothing else would
    // ever clear the flag, and it would wrongly swallow some *unrelated*
    // later click. Clearing it on a 0ms timeout lets same-gesture clicks
    // (which run first, synchronously) see it, while still cleaning up
    // once nothing consumes it.
    if (state.moved) {
      window.setTimeout(() => {
        dragRef.current.moved = false;
      }, 0);
    }
  }

  const handleDayClick = useCallback((itemValue) => {
    // A drag that ended on top of a day button would otherwise also fire
    // that button's click — swallow just that one click after a real drag.
    if (dragRef.current.moved) {
      dragRef.current.moved = false;
      return;
    }
    onSelectDay?.(itemValue);
  }, [onSelectDay]);

  function centerOnDay(day, behavior = "smooth") {
    const node = dayNodesRef.current.get(day);
    const scroller = scrollerRef.current;
    if (!node || !scroller) return;
    programmaticScrollRef.current = true;
    if (programmaticResetRef.current) window.clearTimeout(programmaticResetRef.current);
    programmaticResetRef.current = window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 700);

    if (behavior !== "smooth") {
      // Instant centering (mount, or a long jump) computes the target
      // scrollLeft directly instead of using scrollIntoView: with this
      // strip's CSS scroll-snap (needed so a settled drag/swipe lands on a
      // whole cell) plus a wide, many-week range, scrollIntoView's own
      // snap-aware positioning was landing noticeably off-center in some
      // browsers/timings, while a direct assignment is exact and immune to
      // snap adjustment.
      const rect = scroller.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      const delta = (nodeRect.left + nodeRect.width / 2) - (rect.left + rect.width / 2);
      scroller.scrollLeft += delta;
      return;
    }
    node.scrollIntoView({ inline: "center", block: "nearest", behavior });
  }

  // Today should always sit in the middle at rest: center on the active
  // (selected) day whenever it changes from outside (mount, clicking a day,
  // clicking the today check) — and keep the live box in sync with it.
  //
  // Whether that recenter should be instant or animated is decided from the
  // actual on-screen distance, not a "is this the first render" flag: React
  // Strict Mode runs this effect, its cleanup, then this effect again, all
  // synchronously on mount, so a plain "first mount" ref sees its *second*
  // invocation as "not first" even though nothing has actually settled yet
  // — geometry-based detection gives the same right answer either way,
  // since re-measuring twice in a row is harmless.
  useEffect(() => {
    if (settleTimerRef.current) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    setLiveDay(activeDay);
    const activeIndex = orderedDaysRef.current.indexOf(activeDay);
    if (activeIndex >= 0) lastCenterIndexRef.current = activeIndex;

    const scroller = scrollerRef.current;
    const targetNode = dayNodesRef.current.get(activeDay);
    let instant = true;
    if (scroller && targetNode) {
      const rect = scroller.getBoundingClientRect();
      const nodeRect = targetNode.getBoundingClientRect();
      const drift = Math.abs((rect.left + rect.width / 2) - (nodeRect.left + nodeRect.width / 2));
      // A short hop (clicking an already-nearby day) should still animate;
      // a long jump (mount, or a day far outside the current viewport —
      // now that the range spans months, not just a week) should snap
      // instantly rather than visibly racing the scrollbar across dozens
      // of cells.
      instant = drift > rect.width * 1.5;
    }
    centerOnDay(activeDay, instant ? "auto" : "smooth");
    userInteractedRef.current = false;

    // Only the instant/long-jump case needs the corrective settle loop
    // below — a "smooth" hop is a short, already-visible animation that
    // aggressive re-snapping would just interrupt and make jerky.
    if (!instant) return undefined;

    // With ~180+ cells now in play, other parts of the page (avatar/cover
    // images, slower data fetches, webfonts) can keep nudging layout for a
    // couple of seconds after this first paint, silently drifting the strip
    // out of center — and nothing else re-triggers this effect, since
    // `activeDay` itself hasn't changed. Keep re-snapping instantly (no
    // visible animation) until the active cell is genuinely centered and
    // stays put, the user starts interacting, or a generous safety budget
    // runs out (in case something never stabilizes).
    let frame = null;
    let stableHits = 0;
    const deadline = Date.now() + 8000;

    function tick() {
      frame = null;
      if (userInteractedRef.current || dragRef.current.down || Date.now() > deadline) return;
      const liveScroller = scrollerRef.current;
      const node = dayNodesRef.current.get(activeDay);
      if (!liveScroller || !node) {
        frame = window.requestAnimationFrame(tick);
        return;
      }
      const rect = liveScroller.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      const drift = (rect.left + rect.width / 2) - (nodeRect.left + nodeRect.width / 2);
      if (Math.abs(drift) > 2) {
        stableHits = 0;
        centerOnDay(activeDay, "auto");
      } else {
        stableHits += 1;
        if (stableHits >= 6) return;
      }
      frame = window.requestAnimationFrame(tick);
    }
    frame = window.requestAnimationFrame(tick);

    return () => {
      if (frame != null) window.cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDay]);

  useEffect(() => () => {
    if (settleTimerRef.current) window.clearTimeout(settleTimerRef.current);
    if (programmaticResetRef.current) window.clearTimeout(programmaticResetRef.current);
    if (centerFrameRef.current) window.cancelAnimationFrame(centerFrameRef.current);
  }, []);

  // While actively scrolling/dragging (touch, trackpad, or the mouse-drag
  // above — all funnel through native "scroll" events, including our own
  // scrollLeft writes), keep the highlighted box glued to whichever day is
  // currently centered. Once movement stops for a beat, snap smoothly to
  // dead-center on that day and commit it as the real selection.
  function handleScroll() {
    if (programmaticScrollRef.current) return;
    userInteractedRef.current = true;

    if (centerFrameRef.current == null) {
      centerFrameRef.current = window.requestAnimationFrame(() => {
        centerFrameRef.current = null;
        const day = getCenteredDay();
        if (day) setLiveDay(day);
      });
    }

    if (settleTimerRef.current) window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = null;
      if (dragRef.current.down) return; // still mid-drag, just paused — wait for it to actually end
      const day = getCenteredDay();
      if (!day) return;
      centerOnDay(day, "smooth");
      if (day !== activeDay) onSelectDay?.(day);
    }, WEEK_STRIP_SETTLE_MS);
  }

  return (
    <div className="salonHeroWeekStrip" aria-label={ariaLabel}>
      <button
        type="button"
        className="salonHeroWeekArrow"
        aria-label="تقویم کامل و تاریخچه"
        onClick={onOpenHistory}
      >
        <CalendarDays size={17} />
      </button>
      <div
        className="salonHeroWeekDays"
        ref={scrollerRef}
        onScroll={handleScroll}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
      >
        {items.map((item) => {
          const itemValue = item.id || item.day;
          const itemLabel = item.label || item.day;
          const isActive = liveDay === itemValue || liveDay === item.day;
          return (
            <WeekDayCell
              key={itemValue}
              item={item}
              itemValue={itemValue}
              itemLabel={itemLabel}
              isActive={isActive}
              onRegisterNode={registerDayNode}
              onDayClick={handleDayClick}
            />
          );
        })}
      </div>
    </div>
  );
}
