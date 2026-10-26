"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, LocateFixed, MapPin, Minus, Plus } from "lucide-react";
import { SheetClose } from "./SheetClose";
// Bundled with the app instead of fetched from a CDN, so the map never depends on one being reachable.
import "leaflet/dist/leaflet.css";

const PIN_ZOOM = 16;
const PREVIEW_ZOOM = 15;

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

function pinHtml(label) {
  const tag = label ? `<span class="locPinTag">${escapeHtml(label)}</span>` : "";
  return `<span class="locPin" aria-hidden="true">${tag}<span class="locPinPulse"></span><svg width="44" height="54" viewBox="0 0 38 46"><path d="M19 45s17-15.2 17-26A17 17 0 0 0 2 19c0 10.8 17 26 17 26Z" style="fill:var(--brand-ink);stroke:var(--brand-white)" stroke-width="2.5"/><circle cx="19" cy="19" r="7" style="fill:var(--brand-pink)"/></svg></span>`;
}

const hasPin = (location) => Boolean(location) && Number.isFinite(location.lat) && Number.isFinite(location.lng);

/**
 * The pinned map: Leaflet + OpenStreetMap tiles, the same as «ثبت لوکیشن». `preview` is the small,
 * still picture inside the booking card (no gestures, taps fall through to the card); otherwise it is
 * the full map in the sheet, with the place's name on the pin and onReady handing out the map.
 */
function LocationMap({ lat, lng, label = "", preview = false, onReady }) {
  const containerRef = useRef(null);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  useEffect(() => {
    let map = null;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;
      map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom: preview ? PREVIEW_ZOOM : PIN_ZOOM,
        zoomControl: false,
        attributionControl: false,
        ...(preview ? { dragging: false, touchZoom: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, tap: false } : {})
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      if (!preview) L.control.attribution({ prefix: false, position: "bottomleft" }).addAttribution("© OpenStreetMap").addTo(map);
      L.marker([lat, lng], {
        icon: L.divIcon({ className: "locPinIcon", html: pinHtml(preview ? "" : label), iconSize: [44, 54], iconAnchor: [22, 53] }),
        keyboard: false,
        interactive: false
      }).addTo(map);
      // The pin hangs above its point: in the short preview, lower the view so the whole pin sits in the middle.
      if (preview) map.panBy([0, -22], { animate: false });
      // The sheet slides in: measure again once it has its final size.
      window.setTimeout(() => map?.invalidateSize(), 320);
      readyRef.current?.(map);
    });
    return () => {
      cancelled = true;
      readyRef.current?.(null);
      map?.remove();
    };
  }, [lat, lng, label, preview]);

  return <div className={preview ? "locMap is-preview" : "locMap"} ref={containerRef} role="img" aria-label="محل روی نقشه" />;
}

function LocationSheet({ name, location, onClose }) {
  const mapRef = useRef(null);
  const recenter = () => mapRef.current?.flyTo([location.lat, location.lng], PIN_ZOOM, { duration: 0.6 });
  const zoom = (step) => mapRef.current?.setZoom(mapRef.current.getZoom() + step);

  return createPortal((
    <div className="locSheetOverlay" role="dialog" aria-modal="true" aria-label={`${name} روی نقشه`} onClick={onClose}>
      <article className="locSheet" onClick={(event) => event.stopPropagation()}>
        <div className="locStage">
          <LocationMap lat={location.lat} lng={location.lng} label={name} onReady={(map) => { mapRef.current = map; }} />

          <header className="locSheetHead">
            <span className="locSheetBadge" aria-hidden="true"><MapPin size={18} strokeWidth={2.4} /></span>
            <div>
              <h3>{name}</h3>
              <small>اینجاست</small>
            </div>
          </header>

          <div className="locTools">
            <button type="button" onClick={recenter} aria-label="برگرد سر پین"><LocateFixed size={19} /></button>
            <span className="locZoom">
              <button type="button" onClick={() => zoom(1)} aria-label="بزرگ‌تر"><Plus size={19} /></button>
              <button type="button" onClick={() => zoom(-1)} aria-label="کوچیک‌تر"><Minus size={19} /></button>
            </span>
          </div>
        </div>

        <SheetClose onClick={onClose} />
      </article>
    </div>
  ), document.body);
}

/**
 * The pin next to a salon's or artist's name on their public page. Tapping it opens the pinned
 * spot on a map, and only the map. Renders nothing until the salon or artist has dropped a pin.
 */
export function LocationButton({ name = "", location = null }) {
  const [open, setOpen] = useState(false);
  if (!hasPin(location)) return null;
  return (
    <>
      <button type="button" className="locButton" onClick={() => setOpen(true)} aria-label={`آدرس ${name} روی نقشه`} aria-haspopup="dialog">
        <span className="locButtonRing" aria-hidden="true" />
        <MapPin size={17} strokeWidth={2.4} aria-hidden="true" />
      </button>
      {open && typeof document !== "undefined" ? (
        <LocationSheet name={name} location={location} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

/**
 * «کجا» in the client's booking details: the place's name and area, and once it has a pin, a small
 * map above them; the whole card opens the same map sheet as the pin button. Without a pin it is a
 * plain line of text.
 */
export function LocationCard({ name = "", area = "", location = null }) {
  const [open, setOpen] = useState(false);
  const pinned = hasPin(location);
  const body = (
    <span className="locCardText">
      <span className="locCardIcon" aria-hidden="true"><MapPin size={16} strokeWidth={2.4} /></span>
      <span className="locCardLines">
        <small>کجا</small>
        <b>{name}</b>
        {area && area !== name ? <em>{area}</em> : null}
      </span>
      {pinned ? <span className="locCardGo">روی نقشه<ChevronLeft size={15} aria-hidden="true" /></span> : null}
    </span>
  );
  if (!pinned) return <div className="locCard">{body}</div>;
  return (
    <>
      <button type="button" className="locCard is-pinned" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`${name} روی نقشه`}>
        <span className="locCardMap" aria-hidden="true">
          <LocationMap lat={location.lat} lng={location.lng} preview />
        </span>
        {body}
      </button>
      {open && typeof document !== "undefined" ? (
        <LocationSheet name={name} location={location} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
