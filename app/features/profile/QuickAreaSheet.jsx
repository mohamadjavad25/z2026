"use client";

import { useMemo, useState } from "react";
import { Locate, MapPin, Search } from "lucide-react";
import { ProfileSheet } from "./ProfileSheet";
import { PROVINCES } from "./ProfileLocationSettings";

const ALL_CITIES = PROVINCES.flatMap((province) => province.cities.map((city) => ({ ...city, province: province.name })));

/**
 * One-tap "activity area" picker for the profile checklist: search a city, or
 * use the phone's location, and the area is saved straight away. The detailed
 * map pin stays available in Settings for owners who want it.
 */
export function QuickAreaSheet({ open, onClose, onPick }) {
  const [query, setQuery] = useState("");
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  const visible = useMemo(() => {
    const q = query.trim();
    const list = q ? ALL_CITIES.filter((city) => city.name.includes(q) || city.province.includes(q)) : ALL_CITIES;
    return list.slice(0, 60);
  }, [query]);

  function locateMe() {
    if (!navigator.geolocation) {
      setError("مرورگرت موقعیت‌یابی را پشتیبانی نمی‌کند؛ شهرت را جستجو کن.");
      return;
    }
    setError("");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        const nearest = ALL_CITIES.reduce(
          (best, city) => {
            const distance = Math.abs(city.lat - coords.latitude) + Math.abs(city.lng - coords.longitude);
            return distance < best.distance ? { city, distance } : best;
          },
          { city: null, distance: Infinity }
        ).city;
        if (nearest) onPick?.(nearest.name);
        else setError("شهر نزدیک پیدا نشد؛ دستی جستجو کن.");
      },
      () => {
        setLocating(false);
        setError("دسترسی به موقعیت داده نشد؛ شهرت را جستجو کن.");
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }

  return (
    <ProfileSheet open={open} kicker="یک قدم تا تکمیل" title="محدوده فعالیت" panelClassName="quickAreaSheet" onClose={onClose}>
      <button type="button" className="quickAreaLocate" onClick={locateMe} disabled={locating}>
        <Locate size={17} aria-hidden="true" />
        {locating ? "در حال پیدا کردن شهر…" : "همین‌جا هستم؛ موقعیت فعلی من"}
      </button>
      {error ? <p className="quickAreaError" role="alert">{error}</p> : null}
      <label className="specialtySheetSearch">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="جستجوی شهر… (مثلاً اهواز)"
          aria-label="جستجوی شهر"
        />
      </label>
      <div className="quickAreaList" role="listbox" aria-label="شهرها">
        {visible.map((city) => (
          <button type="button" role="option" aria-selected="false" key={`${city.province}-${city.name}`} onClick={() => onPick?.(city.name)}>
            <MapPin size={15} aria-hidden="true" />
            <b>{city.name}</b>
            <small>{city.province}</small>
          </button>
        ))}
        {visible.length === 0 ? <p className="quickAreaEmpty">شهری پیدا نشد؛ املای دیگری امتحان کن.</p> : null}
      </div>
    </ProfileSheet>
  );
}
