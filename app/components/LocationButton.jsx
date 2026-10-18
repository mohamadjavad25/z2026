"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CarTaxiFront, Check, Copy, MapPin, Navigation } from "lucide-react";
import { SheetClose } from "./SheetClose";
import { SNAPP_URL, detectPlatform, fullAddress, navigationLinks } from "../shared/lib/mapLinks";
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
  const [copied, setCopied] = useState("");
  const [platform, setPlatform] = useState("");
  const address = fullAddress(location);
  const pinned = Number.isFinite(location.lat) && Number.isFinite(location.lng);
  const links = navigationLinks(location, platform);

  useEffect(() => {
    setPlatform(detectPlatform(navigator.userAgent));
  }, []);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      return true;
    } catch {
      return false;
    }
  }

  async function onCopy() {
    if (await copyAddress()) {
      setCopied("copy");
      window.setTimeout(() => setCopied(""), 1800);
    }
  }

  // Snapp takes no destination in a link: copy the address on the way so it is one paste away there.
  // The copy is not awaited, so the browser still sees the tap as what opens the new page.
  function onSnapp() {
    copyAddress().then((ok) => { if (ok) setCopied("snapp"); });
  }

  return createPortal((
    <div className="locSheetOverlay" role="dialog" aria-modal="true" aria-label={`آدرس ${name}`} onClick={onClose}>
      <article className="locSheet" onClick={(event) => event.stopPropagation()}>
        <header className="locSheetHead">
          <span className="locSheetBadge" aria-hidden="true"><MapPin size={18} /></span>
          <div>
            <h3>{name}</h3>
            <small>آدرس و مسیریابی</small>
          </div>
        </header>

        {pinned ? <LocationMap lat={location.lat} lng={location.lng} /> : null}

        <div className="locAddress">
          <p>
            {location.address ? <span>{location.address}</span> : null}
            {location.detail ? <b>{location.detail}</b> : null}
          </p>
          <button type="button" className="locCopy" onClick={onCopy} disabled={!address} aria-label="کپی آدرس">
            {copied === "copy" ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied === "copy" ? "کپی شد" : "کپی"}</span>
          </button>
        </div>
        {!pinned ? <p className="locNoPin">هنوز پین دقیق روی نقشه نگذاشته؛ آدرس بالا را ببین.</p> : null}

        <a className="locSnapp" href={SNAPP_URL} target="_blank" rel="noopener noreferrer" onClick={onSnapp}>
          <CarTaxiFront size={20} aria-hidden="true" />
          <span>
            <b>درخواست اسنپ</b>
            <small>{copied === "snapp" ? "آدرس کپی شد؛ در اسنپ مقصد را بچسبان" : "آدرس کپی می‌شود تا در اسنپ مقصد را بچسبانی"}</small>
          </span>
        </a>

        {links.length ? (
          <div className="locApps" aria-label="مسیریابی با">
            {links.map((link) => (
              <a key={link.id} className={`locApp${link.id === "other" || link.id === "apple" ? " is-wide" : ""}`} href={link.href} target="_blank" rel="noopener noreferrer">
                <Navigation size={16} aria-hidden="true" />
                <span>{link.label}</span>
              </a>
            ))}
          </div>
        ) : null}

        <SheetClose onClick={onClose} />
      </article>
    </div>
  ), document.body);
}

/**
 * The pin next to a salon's or artist's name on their public page. Tapping it opens the exact
 * address on a map with «درخواست اسنپ» and the navigation apps. Renders nothing without a location.
 */
export function LocationButton({ name = "", location = null }) {
  const [open, setOpen] = useState(false);
  if (!location || (!location.address && !Number.isFinite(location.lat))) return null;
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
