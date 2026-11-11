"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  UserRound
} from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { getSalonBookingStaffOptions } from "../../shared/api/salons";

/**
 * Who on the team is free for each service of this booking (salon, editable bookings only),
 * fetched again whenever its day, time, split or status changes.
 * → { ready, availability: [Map(name → { free, skilled, away })] per service, suggested: [name] }
 */
export function useStaffAvailability(booking, enabled) {
  const id = booking?.id;
  const key = enabled && id != null
    ? [id, booking.booking_date || "", booking.time || "", booking.parts || "", booking.staff || "", booking.status || ""].join("|")
    : "";
  const [state, setState] = useState({ key: "", parts: [], suggested: [] });
  useEffect(() => {
    if (!key) return undefined;
    let alive = true;
    const settle = (parts = [], suggested = []) => {
      if (alive) setState({ key, parts, suggested });
    };
    getSalonBookingStaffOptions(id)
      .then(({ ok, data }) => (ok ? settle(data?.parts || [], data?.suggested || []) : settle()))
      .catch(() => settle());
    return () => { alive = false; };
  }, [key, id]);
  return useMemo(() => {
    if (!key || state.key !== key) return { ready: false, availability: [], suggested: [] };
    return {
      ready: state.parts.length > 0,
      availability: state.parts.map((part) => new Map((part.options || []).map((option) => [option.name, option]))),
      suggested: state.suggested
    };
  }, [key, state]);
}

/**
 * «چیدن خودکار»: what the system would do with this booking's artists. Offered when its split
 * differs from the current one; when a service has nobody and nobody is free, says so instead.
 */
export function AutoAssignCard({ current, suggested, services, disabled, onAutoAssign, fresh = false }) {
  const missing = current.filter((name) => !name).length;
  const differs = suggested.some((name, index) => name !== (current[index] || ""));
  const offers = suggested.some(Boolean) && differs;
  if (!offers && !missing) {
    // The split already is the suggestion: say so in one small chip instead of nothing.
    return fresh && suggested.some(Boolean) ? (
      <p className="sbmAutoDone"><Sparkles size={13} aria-hidden="true" />خودکار چیده شد</p>
    ) : null;
  }
  if (!offers) {
    return (
      <p className="sbmAuto is-stuck">
        <UserRound size={15} aria-hidden="true" />
        <span>
          <b>{services > 1 ? `${toPersianDigits(missing)} کار بدون آرتیست` : "این نوبت آرتیست نداره"}</b>
          <small>این ساعت آرتیست آزادی نیست؛ ساعت رو عوض کن یا خودت یکی رو انتخاب کن.</small>
        </span>
      </p>
    );
  }
  const names = [...new Set(suggested.filter(Boolean))];
  return (
    <div className={`sbmAuto ${missing ? "is-missing" : ""}`}>
      <Sparkles size={16} aria-hidden="true" />
      <span>
        <b>{missing ? (services > 1 ? `${toPersianDigits(missing)} کار بدون آرتیست` : "این نوبت آرتیست نداره") : "پیشنهاد ما"}</b>
        <small>{`آزادترین آرتیست‌ها: ${names.join("، ")}`}</small>
      </span>
      <button type="button" disabled={disabled} onClick={onAutoAssign}>چیدن خودکار</button>
    </div>
  );
}
