"use client";

import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";

const MAX_ZOOM = 4;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Pan + zoom crop frame. The frame has the exact aspect ratio the image is
 * displayed at in the app, so what the user frames here is what ends up on
 * screen. `ref.current.exportCrop()` bakes the framed region into a new
 * image (data URL), which means every surface that shows it renders the same
 * pixels instead of re-deriving a crop from CSS object-position.
 */
export function ImageCropper({
  ref,
  src,
  aspect = 1,
  shape = "rect",
  outputWidth = 1080,
  quality = 0.9,
  hint = "تصویر را بکشید و با اسلایدر یا دو انگشت بزرگ و کوچک کنید.",
  className = ""
}) {
  const frameRef = useRef(null);
  const [natural, setNatural] = useState(null);
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const pointers = useRef(new Map());
  const gesture = useRef(null);

  useEffect(() => {
    setNatural(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    if (!src) return undefined;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setNatural({ w: img.naturalWidth, h: img.naturalHeight, el: img });
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  useLayoutEffect(() => {
    const node = frameRef.current;
    if (!node) return undefined;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      setFrame({ w: rect.width, h: rect.height });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const baseScale = natural && frame.w ? Math.max(frame.w / natural.w, frame.h / natural.h) : 1;
  const scale = baseScale * zoom;

  // Keeps the image fully covering the frame (no empty edges) at any zoom.
  const clampOffset = useCallback((next, nextScale) => {
    if (!natural) return next;
    const maxX = Math.max(0, (natural.w * nextScale - frame.w) / 2);
    const maxY = Math.max(0, (natural.h * nextScale - frame.h) / 2);
    return { x: clamp(next.x, -maxX, maxX), y: clamp(next.y, -maxY, maxY) };
  }, [natural, frame.w, frame.h]);

  const applyZoom = useCallback((nextZoom) => {
    const z = clamp(nextZoom, 1, MAX_ZOOM);
    setZoom(z);
    setOffset((current) => clampOffset(current, baseScale * z));
  }, [baseScale, clampOffset]);

  useEffect(() => {
    // Frame resized (rotation, sheet resize): re-clamp so nothing is exposed.
    setOffset((current) => clampOffset(current, baseScale * zoom));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame.w, frame.h]);

  function pinchDistance() {
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  function handlePointerDown(event) {
    if (!natural) return;
    event.preventDefault();
    frameRef.current?.setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    gesture.current = {
      startOffset: offset,
      startZoom: zoom,
      startX: event.clientX,
      startY: event.clientY,
      startDistance: pinchDistance()
    };
  }

  function handlePointerMove(event) {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size >= 2 && gesture.current.startDistance) {
      const nextZoom = clamp(gesture.current.startZoom * (pinchDistance() / gesture.current.startDistance), 1, MAX_ZOOM);
      setZoom(nextZoom);
      setOffset((current) => clampOffset(current, baseScale * nextZoom));
      return;
    }
    const g = gesture.current;
    setOffset(clampOffset({
      x: g.startOffset.x + (event.clientX - g.startX),
      y: g.startOffset.y + (event.clientY - g.startY)
    }, scale));
  }

  function handlePointerUp(event) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 1) {
      // Pinch ended with one finger still down: continue as a pan from here.
      const [rest] = [...pointers.current.values()];
      gesture.current = { startOffset: offset, startZoom: zoom, startX: rest.x, startY: rest.y, startDistance: 0 };
    } else if (pointers.current.size === 0) {
      gesture.current = null;
    }
  }

  function handleWheel(event) {
    if (!natural) return;
    applyZoom(zoom * (event.deltaY < 0 ? 1.08 : 1 / 1.08));
  }

  useImperativeHandle(ref, () => ({
    exportCrop() {
      if (!natural || !frame.w) return null;
      const outW = Math.max(1, Math.round(Math.min(outputWidth, frame.w / scale)));
      const outH = Math.max(1, Math.round(outW / aspect));
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, outW, outH);
      ctx.imageSmoothingQuality = "high";
      const left = frame.w / 2 + offset.x - (natural.w * scale) / 2;
      const top = frame.h / 2 + offset.y - (natural.h * scale) / 2;
      ctx.drawImage(
        natural.el,
        -left / scale,
        -top / scale,
        frame.w / scale,
        frame.h / scale,
        0,
        0,
        outW,
        outH
      );
      return canvas.toDataURL("image/jpeg", quality);
    }
  }), [natural, frame.w, frame.h, outputWidth, aspect, quality, scale, offset]);

  const imgStyle = natural
    ? {
        width: natural.w * scale,
        height: natural.h * scale,
        transform: `translate(${frame.w / 2 + offset.x - (natural.w * scale) / 2}px, ${frame.h / 2 + offset.y - (natural.h * scale) / 2}px)`
      }
    : undefined;

  return (
    <div className={`imageCropper ${className}`.trim()}>
      <div
        ref={frameRef}
        className={`imageCropperFrame is-${shape}`}
        style={{ aspectRatio: String(aspect) }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
        {natural ? <img src={src} alt="" draggable={false} style={imgStyle} /> : <span className="imageCropperLoading" />}
        <span className="imageCropperGrid" aria-hidden="true" />
      </div>
      <div className="imageCropperZoom">
        <button type="button" onClick={() => applyZoom(zoom - 0.25)} aria-label="کوچک‌نمایی" disabled={zoom <= 1}>
          <Minus size={15} aria-hidden="true" />
        </button>
        <input
          type="range"
          min="1"
          max={MAX_ZOOM}
          step="0.01"
          value={zoom}
          onChange={(event) => applyZoom(Number(event.target.value))}
          aria-label="بزرگ‌نمایی"
        />
        <button type="button" onClick={() => applyZoom(zoom + 0.25)} aria-label="بزرگ‌نمایی" disabled={zoom >= MAX_ZOOM}>
          <Plus size={15} aria-hidden="true" />
        </button>
      </div>
      {hint ? <p className="imageCropperHint">{hint}</p> : null}
    </div>
  );
}
