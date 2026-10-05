import { getArtistRailFrame, clampRail, snapArtistRailDock, ARTIST_RAIL_DOCK_KEY } from "./railUtils";

export function useArtistRailDrag({
  artistRailDragRef,
  setArtistRailDragPos,
  artistRailRef,
  setArtistRailDragging,
  setArtistBookingRailOpen,
  artistRailSize,
  setArtistRailDock
}) {
  function clearArtistRailLongPress() {
    const drag = artistRailDragRef.current;
    if (drag.longPressTimer) {
      window.clearTimeout(drag.longPressTimer);
      drag.longPressTimer = null;
    }
  }

  function flushArtistRailDragPos() {
    const drag = artistRailDragRef.current;
    drag.raf = 0;
    if (!drag.pending) return;
    setArtistRailDragPos(drag.pending);
    drag.pending = null;
  }

  function beginArtistRailDrag() {
    const rail = artistRailRef.current;
    const drag = artistRailDragRef.current;
    if (!rail) return;
    const rect = rail.getBoundingClientRect();
    drag.dragging = true;
    drag.armed = true;
    drag.offsetX = drag.startX - rect.left;
    drag.offsetY = drag.startY - rect.top;
    setArtistRailDragging(true);
    setArtistBookingRailOpen(false);
    const frame = getArtistRailFrame();
    setArtistRailDragPos({
      x: clampRail(rect.left, frame.left + 8, frame.left + frame.width - rect.width - 8),
      y: clampRail(rect.top, frame.top + 8, frame.top + frame.height - rect.height - 8)
    });
    if (drag.pointerId != null) {
      try {
        const handle = rail.querySelector(".artistBookingRailHandle");
        (handle || rail).setPointerCapture(drag.pointerId);
      } catch {
        // ignore
      }
    }
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(12);
    }
  }

  function onArtistRailHandlePointerDown(event) {
    if (event.button != null && event.button !== 0) return;
    const drag = artistRailDragRef.current;
    clearArtistRailLongPress();
    drag.pointerId = event.pointerId;
    drag.armed = false;
    drag.dragging = false;
    drag.moved = false;
    drag.startX = event.clientX;
    drag.startY = event.clientY;
    drag.originX = event.clientX;
    drag.originY = event.clientY;
    beginArtistRailDrag();
  }

  function onArtistRailHandlePointerMove(event) {
    const drag = artistRailDragRef.current;
    if (drag.pointerId !== event.pointerId) return;

    drag.startX = event.clientX;
    drag.startY = event.clientY;

    const deltaX = Math.abs(event.clientX - (drag.originX ?? event.clientX));
    const deltaY = Math.abs(event.clientY - (drag.originY ?? event.clientY));
    if (!drag.dragging && (deltaX > 8 || deltaY > 8)) {
      clearArtistRailLongPress();
    }

    if (!drag.dragging) return;

    const rail = artistRailRef.current;
    const width = rail?.offsetWidth || artistRailSize.w;
    const height = rail?.offsetHeight || artistRailSize.h;
    const frame = getArtistRailFrame();
    const nextX = clampRail(event.clientX - drag.offsetX, frame.left + 8, frame.left + frame.width - width - 8);
    const nextY = clampRail(event.clientY - drag.offsetY, frame.top + 8, frame.top + frame.height - height - 8);
    drag.moved = true;
    drag.pending = { x: nextX, y: nextY };
    if (!drag.raf) {
      drag.raf = window.requestAnimationFrame(flushArtistRailDragPos);
    }
  }

  function onArtistRailHandlePointerUp(event) {
    const drag = artistRailDragRef.current;
    if (drag.pointerId !== event.pointerId) return;
    clearArtistRailLongPress();
    if (drag.raf) {
      window.cancelAnimationFrame(drag.raf);
      flushArtistRailDragPos();
    }

    if (drag.dragging) {
      const rail = artistRailRef.current;
      const width = rail?.offsetWidth || artistRailSize.w;
      const height = rail?.offsetHeight || artistRailSize.h;
      const rect = rail?.getBoundingClientRect();
      const centerX = rect ? rect.left + rect.width / 2 : event.clientX;
      const centerY = rect ? rect.top + rect.height / 2 : event.clientY;
      const dock = snapArtistRailDock(centerX, centerY, width, height);
      setArtistRailDock(dock);
      try {
        window.localStorage.setItem(ARTIST_RAIL_DOCK_KEY, JSON.stringify(dock));
      } catch {
        // ignore
      }
      setArtistRailDragging(false);
      setArtistRailDragPos(null);
      drag.dragging = false;
      drag.moved = true;
      window.setTimeout(() => {
        drag.moved = false;
      }, 220);
    }

    drag.pointerId = null;
    drag.armed = false;
    try {
      artistRailRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }

  return {
    clearArtistRailLongPress,
    flushArtistRailDragPos,
    beginArtistRailDrag,
    onArtistRailHandlePointerDown,
    onArtistRailHandlePointerMove,
    onArtistRailHandlePointerUp
  };
}
