"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Locate, MapPin, Search, X } from "lucide-react";
// Bundled with the app instead of fetched from unpkg, so the map never depends on a CDN being reachable.
import "leaflet/dist/leaflet.css";
import { PROVINCES } from "./iranCities";

const ALL_CITIES = PROVINCES.flatMap((province) => province.cities.map((city) => ({ ...city, province: province.name })));
const IRAN_CENTER = { lat: 32.4279, lng: 53.688 };
const CITY_ZOOM = 13;
const PIN_ZOOM = 17;

const PIN_HTML = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="#14161d" stroke="#fff" stroke-width="1.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="#fff" stroke="#14161d"/></svg>`;

function nearestCity(lat, lng) {
  return ALL_CITIES.reduce(
    (best, city) => {
      const distance = Math.abs(city.lat - lat) + Math.abs(city.lng - lng);
      return distance < best.distance ? { city, distance } : best;
    },
    { city: null, distance: Infinity }
  ).city;
}

/**
 * Where the salon / artist works, on a map from the first moment (owner's request 2026-10-23): the
 * phone's own position is asked for at once and pinned exactly; the pin can be dragged, or the map
 * tapped, to move it. When the position cannot be had (no permission, no signal), a city search
 * puts the map on that city instead. Saves `{ area, geo: { lat, lng }, addressDetail }`, the same
 * shape as «ثبت لوکیشن» in Settings; `area` is the street address when the map service answers,
 * else the nearest city.
 */
export function MapPinPicker({ initialPin = null, initialDetail = "", askDetail = true, saving = false, saveLabel = "ذخیره همین‌جا", onSave, onCancel }) {
  const [pin, setPin] = useState(initialPin);
  const [address, setAddress] = useState("");
  const [addressLoading, setAddressLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState(initialDetail);

  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const leafletRef = useRef(null);
  const geocodeRequest = useRef(0);

  const cityMatches = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return ALL_CITIES.filter((city) => city.name.includes(q) || city.province.includes(q)).slice(0, 6);
  }, [query]);

  async function lookUpAddress(lat, lng) {
    const request = ++geocodeRequest.current;
    const city = nearestCity(lat, lng);
    setAddress(city ? city.name : "");
    setAddressLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=fa&zoom=18&addressdetails=1`
      );
      const data = await res.json();
      if (request !== geocodeRequest.current) return;
      const a = data?.address || {};
      const parts = [a.city || a.town || a.village || a.state, a.suburb || a.neighbourhood || a.quarter, a.road].filter(Boolean);
      if (parts.length) setAddress(parts.join("، "));
    } catch {
      // No answer from the map service: the nearest city already stands in.
    } finally {
      if (request === geocodeRequest.current) setAddressLoading(false);
    }
  }

  function placePin(position, zoom) {
    setPin(position);
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (markerRef.current) markerRef.current.setLatLng(position);
    else {
      const icon = L.divIcon({ className: "profileLocationMapPin", html: PIN_HTML, iconSize: [40, 40], iconAnchor: [20, 40] });
      markerRef.current = L.marker(position, { icon, draggable: true }).addTo(map);
      markerRef.current.on("dragend", () => {
        const moved = markerRef.current.getLatLng();
        setPin({ lat: moved.lat, lng: moved.lng });
        lookUpAddress(moved.lat, moved.lng);
      });
    }
    if (zoom) map.setView(position, zoom);
    lookUpAddress(position.lat, position.lng);
  }

  // The phone's own position: precise first; if that fails for a reason other than permission,
  // once more without high accuracy (often answers indoors or when GPS is slow).
  function locate() {
    if (!navigator.geolocation) {
      setNote("این گوشی موقعیت نمی‌دهد؛ روی نقشه بزن یا شهرت را جستجو کن.");
      return;
    }
    setNote("");
    setLocating(true);
    const done = ({ coords }) => {
      setLocating(false);
      placePin({ lat: coords.latitude, lng: coords.longitude }, PIN_ZOOM);
    };
    const failed = (error) => {
      setLocating(false);
      setNote(error?.code === 1
        ? "اجازهٔ موقعیت داده نشد؛ روی نقشه بزن یا شهرت را جستجو کن."
        : "موقعیتت پیدا نشد؛ روی نقشه بزن یا شهرت را جستجو کن.");
    };
    navigator.geolocation.getCurrentPosition(done, (error) => {
      if (error?.code === 1) return failed(error);
      navigator.geolocation.getCurrentPosition(done, failed, { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  }

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((module) => {
      if (cancelled || !boxRef.current || mapRef.current) return;
      const L = module.default || module;
      leafletRef.current = L;
      const start = initialPin || IRAN_CENTER;
      const map = L.map(boxRef.current, { center: [start.lat, start.lng], zoom: initialPin ? PIN_ZOOM : 5, zoomControl: false, attributionControl: false });
      L.control.zoom({ position: "bottomleft" }).addTo(map);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      map.on("click", (event) => placePin({ lat: event.latlng.lat, lng: event.latlng.lng }));
      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 120);
      if (initialPin) placePin(initialPin);
      else locate();
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Built once per opening; the handlers read state through setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickCity(city) {
    setQuery("");
    setNote("");
    placePin({ lat: city.lat, lng: city.lng }, CITY_ZOOM);
  }

  return (
    <div className="mpp">
      <div className="mppSearch">
        <label className="mppSearchBox">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جستجوی شهر… (مثلاً اهواز)"
            aria-label="جستجوی شهر"
            autoComplete="off"
          />
          {query ? (
            <button type="button" className="mppIconBtn" onClick={() => setQuery("")} aria-label="پاک کردن جستجو"><X size={14} /></button>
          ) : null}
        </label>
        {cityMatches.length ? (
          <div className="mppCities" role="listbox" aria-label="شهرها">
            {cityMatches.map((city) => (
              <button type="button" role="option" aria-selected="false" key={`${city.province}-${city.name}`} onClick={() => pickCity(city)}>
                <MapPin size={14} aria-hidden="true" />
                <b>{city.name}</b>
                <small>{city.province}</small>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mppMapWrap">
        <div className="mppMap" ref={boxRef} />
        <button type="button" className="mppLocate" onClick={locate} disabled={locating}>
          <Locate size={16} aria-hidden="true" />
          {locating ? "در حال پیدا کردن…" : "موقعیت فعلی من"}
        </button>
      </div>

      {note ? <p className="mppNote" role="status">{note}</p> : null}
      <p className="mppAddress">
        <MapPin size={15} aria-hidden="true" />
        <span>
          {pin
            ? (addressLoading && !address ? "در حال پیدا کردن آدرس…" : address || "جای پین")
            : locating ? "در حال پیدا کردن جای دقیقت…" : "روی نقشه بزن تا پین بگذاری"}
        </span>
      </p>
      {pin ? <p className="mppHint">اگر دقیق نیست، پین را بکش یا روی جای درست بزن.</p> : null}

      {askDetail ? (
        <label className="mppDetail">
          <span>پلاک، طبقه، واحد (اختیاری)</span>
          <input value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="مثلاً پلاک ۸، طبقه ۲، زنگ رز" maxLength={160} autoComplete="off" />
        </label>
      ) : null}

      <div className="mppActions">
        <button
          type="button"
          className="mppSave"
          disabled={!pin || !address || saving}
          onClick={() => onSave?.({ area: address, geo: pin, addressDetail: detail.trim() })}
        >
          <Check size={16} aria-hidden="true" />
          {saving ? "در حال ذخیره…" : saveLabel}
        </button>
        {onCancel ? <button type="button" className="mppCancel" onClick={onCancel}>انصراف</button> : null}
      </div>
    </div>
  );
}
