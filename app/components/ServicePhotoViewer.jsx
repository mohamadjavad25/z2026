"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { servicePriceText } from "../shared/lib/money";
import { useBackHandler } from "../shared/hooks/useBackHandler";

/**
 * Client — the big sample photos of one service, opened from its row in the services menu. Swipe sideways for the
 * next photo. «همین رو می‌خوام» picks the service (the same pick as tapping its row) and closes this; with
 * `browseOnly` (online booking paused) there is nothing to pick, so only «بستن» shows.
 */
export function ServicePhotoViewer({ service, picked = false, browseOnly = false, onPick, onClose }) {
  useBackHandler(Boolean(service), onClose);
  const photos = Array.isArray(service?.photos) ? service.photos : [];
  const [index, setIndex] = useState(0);
  const track = useRef(null);

  useEffect(() => {
    if (!service) return undefined;
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [service, onClose]);

  if (!service || !photos.length) return null;

  return (
    <>
      <button type="button" className="sduDim spvDim" aria-label="بستن نمونه‌ها" onClick={onClose} />
      <div className="spvSheet" role="dialog" aria-modal="true" aria-label={`نمونه‌های ${service.name}`}>
        <button type="button" className="spvX" onClick={onClose} aria-label="بستن"><X size={18} /></button>
        <div
          className="spvTrack"
          ref={track}
          onScroll={(event) => {
            const el = event.currentTarget;
            const width = el.clientWidth || 1;
            setIndex(Math.min(photos.length - 1, Math.max(0, Math.round(Math.abs(el.scrollLeft) / width))));
          }}
        >
          {photos.map((photo) => (
            <div className="spvSlide" key={photo.postId}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${photo.image}&w=720`} alt={photo.title || service.name} />
            </div>
          ))}
        </div>
        {photos.length > 1 ? (
          <div className="spvDots" aria-hidden="true">
            {photos.map((photo, i) => <i key={photo.postId} className={i === index ? "is-on" : ""} />)}
          </div>
        ) : null}
        <div className="spvInfo">
          <h3>{service.name}</h3>
          {service.priceHidden ? null : <span className="spvPrice">{servicePriceText(service.price) || "قیمت توافقی"}</span>}
        </div>
        {browseOnly ? null : (
          <button type="button" className={`spvPick${picked ? " is-picked" : ""}`} onClick={() => { onPick?.(); onClose(); }}>
            {picked ? <><Check size={16} strokeWidth={3} /> انتخاب شده</> : "همین رو می‌خوام"}
          </button>
        )}
      </div>
    </>
  );
}
