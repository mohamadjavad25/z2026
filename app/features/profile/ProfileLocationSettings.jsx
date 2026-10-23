"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, MapPin, X } from "lucide-react";
import { onOpenLocationSettings } from "./locationEvents";
import { MapPinPicker } from "./MapPinPicker";
import { PROVINCES } from "./iranCities";

export { PROVINCES };

/**
 * «ثبت لوکیشن»: one row that opens the map (MapPinPicker: the phone's position pinned at once, the pin
 * draggable, a city search when there is no position) plus plate / floor / unit. Saves
 * { area, geo: { lat, lng }, addressDetail }; clients see it behind the pin next to the
 * name on the public page (components/LocationButton). onSave({ area: "" }) removes it.
 */
export function ProfileLocationSettings({
  profileType,
  value,
  location = null,
  saving = false,
  onSave
}) {
  const [mapOpen, setMapOpen] = useState(false);
  const panelRef = useRef(null);
  const address = String(value || "");
  const savedPin = Number.isFinite(location?.lat) && Number.isFinite(location?.lng)
    ? { lat: location.lat, lng: location.lng }
    : null;

  // Asked from the profile hero: open the editor and bring it into view once Settings shows.
  useEffect(() => onOpenLocationSettings(() => {
    setMapOpen(true);
    setTimeout(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }), []);

  async function save(next) {
    await onSave?.(next);
    setMapOpen(false);
  }

  const hasAddress = Boolean(address);

  return (
    <section className="profileLocationSettings" aria-label="ثبت لوکیشن" ref={panelRef}>
      {!mapOpen && (
        <button type="button" className="profileLocationRow" onClick={() => setMapOpen(true)}>
          <span className="profileLocationRowIcon" aria-hidden="true">
            <MapPin size={17} />
          </span>
          <span className="profileLocationRowInfo">
            <strong>ثبت لوکیشن</strong>
            <span>
              {hasAddress
                ? [address, location?.detail].filter(Boolean).join("، ")
                : profileType === "salon" ? "روی نقشه محل سالن را مشخص کن" : "روی نقشه محل کارت رو مشخص کن"}
            </span>
            {hasAddress && !savedPin && profileType !== "client" ? (
              <small className="profileLocationNoPin">پین روی نقشه نداری؛ بزن و پین بگذار تا مشتری راحت پیدایت کند.</small>
            ) : null}
          </span>
          {hasAddress ? (
            <span
              role="button"
              tabIndex={0}
              className="profileLocationRowClear"
              onClick={(e) => { e.stopPropagation(); onSave?.({ area: "" }); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onSave?.({ area: "" }); } }}
              aria-label="حذف لوکیشن"
            >
              <X size={13} />
            </span>
          ) : (
            <ChevronLeft size={16} className="profileLocationRowChevron" aria-hidden="true" />
          )}
        </button>
      )}

      {mapOpen && (
        <div className="profileLocationMapPanel">
          <MapPinPicker
            initialPin={savedPin}
            initialDetail={location?.detail || ""}
            askDetail={profileType !== "client"}
            saving={saving}
            saveLabel="تایید و ذخیره لوکیشن"
            onSave={save}
            onCancel={() => setMapOpen(false)}
          />
        </div>
      )}
    </section>
  );
}
