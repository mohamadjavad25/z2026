"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CarTaxiFront, Check, Copy, MapPin, Navigation } from "lucide-react";
import { SheetClose } from "./SheetClose";
import { SNAPP_URL, TAPSI_SITE_URL, detectPlatform, fullAddress, navigationLinks, tapsiRideLink, tapsiWebLink } from "../shared/lib/mapLinks";
// Bundled with the app instead of fetched from a CDN, so the map never depends on one being reachable.
import "leaflet/dist/leaflet.css";

const PIN_ZOOM = 16;
// Still on this page this long after «درخواست تپسی»: Tapsi did not open (most likely not installed).
const TAPSI_OPEN_WAIT_MS = 1800;
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
  const [origin, setOrigin] = useState(null);
  const [tapsiMissed, setTapsiMissed] = useState(false);
  // "" | "locating" | "denied" | "unavailable": asking the phone where the client is before Tapsi opens.
  const [tapsiLocate, setTapsiLocate] = useState("");
  const address = fullAddress(location);
  const pinned = Number.isFinite(location.lat) && Number.isFinite(location.lng);
  const links = navigationLinks(location, platform);

  useEffect(() => {
    setPlatform(detectPlatform(navigator.userAgent));
  }, []);

  // Tapsi's start point, read quietly when the client already allowed this site their location. When
  // not, «درخواست تپسی» asks on the tap (onTapsi): without a start Tapsi opens on «کجا هستید؟».
  useEffect(() => {
    if (!pinned || !navigator.geolocation || !navigator.permissions?.query) return;
    let cancelled = false;
    navigator.permissions.query({ name: "geolocation" }).then((status) => {
      if (cancelled || status.state !== "granted") return;
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => { if (!cancelled) setOrigin({ lat: coords.latitude, lng: coords.longitude }); },
        () => {},
        { maximumAge: 120000, timeout: 8000 }
      );
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [pinned]);

  // Android: Tapsi's app on the ride. Elsewhere: the same ride in Tapsi's web app. Only with a pin: without
  // one Tapsi would open on its home page with nothing filled, which left the client stuck (user's
  // decision 2026-10-20); the owner is asked for the pin in «تکمیل پروفایل» instead.
  const tapsiRide = tapsiRideLink(location, platform, origin);
  const tapsiWeb = tapsiWebLink(location, origin);
  const showTapsi = Boolean(tapsiWeb);
  const tapsiHint = origin
    ? "مسیر آماده است؛ فقط ماشین را انتخاب کن"
    : tapsiLocate === "locating" ? "در حال پیدا کردن جای تو…" : "جای تو را می‌گیریم تا مسیر کامل آماده شود";

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

  // Leaving for Tapsi's app hides this page; if it is still showing a moment later, Tapsi did not open.
  function watchTapsiOpens() {
    setTapsiMissed(false);
    const startedAt = Date.now();
    window.setTimeout(() => {
      if (document.visibilityState === "visible" && Date.now() - startedAt < TAPSI_OPEN_WAIT_MS * 2) setTapsiMissed(true);
    }, TAPSI_OPEN_WAIT_MS);
  }

  function openTapsi(from) {
    const ride = tapsiRideLink(location, platform, from);
    window.location.assign(ride || tapsiWebLink(location, from));
    if (ride) watchTapsiOpens();
  }

  // Ask the phone where the client is, then open Tapsi with both ends: straight to the car choice.
  // If the browser no longer counts this as the tap and keeps Tapsi's app shut, the hint asks for one
  // more tap; the link already has the start by then.
  function locateThenOpen() {
    setTapsiMissed(false);
    setTapsiLocate("locating");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const here = { lat: coords.latitude, lng: coords.longitude };
        setOrigin(here);
        setTapsiLocate("");
        openTapsi(here);
      },
      (error) => setTapsiLocate(error?.code === 1 ? "denied" : "unavailable"),
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 12000 }
    );
  }

  function onTapsi(event) {
    if (tapsiLocate === "locating") {
      event.preventDefault();
      return;
    }
    if (!origin && navigator.geolocation) {
      event.preventDefault();
      locateThenOpen();
      return;
    }
    setTapsiLocate("");
    if (tapsiRide) watchTapsiOpens();
  }

  // The client's choice when their position cannot be had: Tapsi with the salon only, asking «کجا هستید؟».
  function openTapsiWithoutStart() {
    setTapsiLocate("");
    openTapsi(null);
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

        {showTapsi ? (
          <>
            <a
              className="locRide"
              href={tapsiRide || tapsiWeb}
              {...(tapsiRide ? {} : { target: "_blank", rel: "noopener noreferrer" })}
              onClick={onTapsi}
              aria-busy={tapsiLocate === "locating"}
            >
              <CarTaxiFront size={20} aria-hidden="true" />
              <span>
                <b>درخواست تپسی</b>
                <small>{tapsiHint}</small>
              </span>
            </a>
            {tapsiLocate === "denied" || tapsiLocate === "unavailable" ? (
              <div className="locRideAsk" role="alert">
                <p>
                  {tapsiLocate === "denied"
                    ? "اجازهٔ موقعیت داده نشد. برای مسیر کامل، به فرفرو اجازهٔ موقعیت بده."
                    : "جای تو پیدا نشد. موقعیت (GPS) گوشی را روشن کن و دوباره بزن."}
                </p>
                <div>
                  <button type="button" onClick={locateThenOpen}>دوباره امتحان کن</button>
                  <button type="button" className="is-soft" onClick={openTapsiWithoutStart}>بدون آن برو</button>
                </div>
                <small>«بدون آن برو»: تپسی باز می‌شود و جای تو را در خودش می‌پرسد.</small>
              </div>
            ) : null}
            {tapsiMissed ? (
              <p className="locRideMissed">
                تپسی باز نشد؟ یک بار دیگر بزن، یا <a href={tapsiWeb} target="_blank" rel="noopener noreferrer">با نسخهٔ وب تپسی برو</a> یا <a href={TAPSI_SITE_URL} target="_blank" rel="noopener noreferrer">اپ تپسی را بگیر</a>.
              </p>
            ) : null}
          </>
        ) : null}

        <a className={`locRide${showTapsi ? " is-soft" : ""}`} href={SNAPP_URL} target="_blank" rel="noopener noreferrer" onClick={onSnapp}>
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
 * address on a map with «درخواست تپسی», «درخواست اسنپ» and the navigation apps. Renders nothing without a location.
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
