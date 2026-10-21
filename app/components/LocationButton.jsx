"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapPin } from "lucide-react";
import { SheetClose } from "./SheetClose";
// Bundled with the app instead of fetched from a CDN, so the map never depends on one being reachable.
import "leaflet/dist/leaflet.css";

const PIN_ZOOM = 16;
const PIN_HTML = `<span class="locPin" aria-hidden="true"><span class="locPinPulse"></span><svg width="38" height="46" viewBox="0 0 38 46"><path d="M19 45s17-15.2 17-26A17 17 0 0 0 2 19c0 10.8 17 26 17 26Z" style="fill:var(--brand-ink);stroke:var(--brand-white)" stroke-width="2.5"/><circle cx="19" cy="19" r="7" style="fill:var(--brand-pink)"/></svg></span>`;

/** The pinned map inside the sheet: Leaflet + OpenStreetMap tiles, the same as «ثبت لوکیشن». */
function LocationMap({ lat, lng }) {
  const containerRef = useRef(null);

  useEffect(() => {
    let map = null;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;
      map = L.map(containerRef.current, { center: [lat, lng], zoom: PIN_ZOOM, zoomControl: false, attributionControl: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      L.control.attribution({ prefix: false, position: "bottomleft" }).addAttribution("© OpenStreetMap").addTo(map);
      L.marker([lat, lng], {
        icon: L.divIcon({ className: "locPinIcon", html: PIN_HTML, iconSize: [38, 46], iconAnchor: [19, 45] }),
        keyboard: false,
        interactive: false
      }).addTo(map);
      // The sheet slides in: measure again once it has its final size.
      window.setTimeout(() => map?.invalidateSize(), 320);
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [lat, lng]);

  return <div className="locMap" ref={containerRef} role="img" aria-label="محل روی نقشه" />;
}

function LocationSheet({ name, location, onClose }) {
  return createPortal((
    <div className="locSheetOverlay" role="dialog" aria-modal="true" aria-label={`${name} روی نقشه`} onClick={onClose}>
      <article className="locSheet" onClick={(event) => event.stopPropagation()}>
        <header className="locSheetHead">
          <span className="locSheetBadge" aria-hidden="true"><MapPin size={18} /></span>
          <div>
            <h3>{name}</h3>
            <small>روی نقشه</small>
          </div>
        </header>

        <LocationMap lat={location.lat} lng={location.lng} />

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
  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return null;
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
