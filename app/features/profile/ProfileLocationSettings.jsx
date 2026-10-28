"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, MapPin, X } from "lucide-react";
import { onOpenLocationSettings } from "./locationEvents";
import { MapPinPicker } from "./MapPinPicker";
import { ProfileSheet } from "./ProfileSheet";
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
  // One tap on the small ✕ must never delete a saved spot: it asks first.
  const [askClear, setAskClear] = useState(false);
  const address = String(value || "");
  const savedPin = Number.isFinite(location?.lat) && Number.isFinite(location?.lng)
    ? { lat: location.lat, lng: location.lng }
    : null;

  // Asked from the profile hero: open the editor once Settings shows.
  useEffect(() => onOpenLocationSettings(() => setMapOpen(true)), []);

  async function save(next) {
    await onSave?.(next);
    setMapOpen(false);
  }

  const hasAddress = Boolean(address);

  return (
    <section className="profileLocationSettings" aria-label="جام روی نقشه">
      {askClear && (
        <div className="profileLocationAsk" role="alertdialog" aria-label="پاک کردن جا از نقشه">
          <strong>جات از روی نقشه پاک بشه؟</strong>
          <span>مشتری‌ها دیگه آدرست رو نمی‌بینن.</span>
          <div>
            <button type="button" className="profileLocationAskYes" disabled={saving} onClick={async () => { await onSave?.({ area: "" }); setAskClear(false); }}>آره، پاک کن</button>
            <button type="button" className="profileLocationAskNo" onClick={() => setAskClear(false)}>نه، بمونه</button>
          </div>
        </div>
      )}

      {!askClear && (
        <button type="button" className="profileLocationRow" onClick={() => setMapOpen(true)}>
          <span className="profileLocationRowIcon" aria-hidden="true">
            <MapPin size={17} />
          </span>
          <span className="profileLocationRowInfo">
            <strong>جام روی نقشه</strong>
            <span>
              {hasAddress
                ? [address, location?.detail].filter(Boolean).join("، ")
                : profileType === "client" ? "سالن‌های نزدیکت رو ببین" : "روی نقشه نشون بده"}
            </span>
            {hasAddress && !savedPin && profileType !== "client" ? (
              <small className="profileLocationNoPin">پین نذاشتی هنوز</small>
            ) : null}
          </span>
          {hasAddress ? (
            <span
              role="button"
              tabIndex={0}
              className="profileLocationRowClear"
              onClick={(e) => { e.stopPropagation(); setAskClear(true); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setAskClear(true); } }}
              aria-label="پاک کردن جام از نقشه"
            >
              <X size={13} />
            </span>
          ) : (
            <ChevronLeft size={16} className="profileLocationRowChevron" aria-hidden="true" />
          )}
        </button>
      )}

      {/* The map opens in its own sheet, so the row never grows in place (owner's decision 2026-10-28). */}
      <ProfileSheet open={mapOpen} kicker="تنظیمات" title="جام روی نقشه" label="جام روی نقشه" onClose={() => setMapOpen(false)}>
        <div className="profileLocationMapPanel">
          <MapPinPicker
            initialPin={savedPin}
            initialAddress={address}
            initialDetail={location?.detail || ""}
            askDetail={profileType !== "client"}
            saving={saving}
            saveLabel="همین‌جا رو ذخیره کن"
            onSave={save}
            onCancel={() => setMapOpen(false)}
          />
        </div>
      </ProfileSheet>
    </section>
  );
}
