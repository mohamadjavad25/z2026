"use client";

import { useEffect, useState } from "react";
import { ProfileSheet } from "../profile/ProfileSheet";
import { AddPlaceActions } from "./AddPlaceActions";
import { requestBookElsewhere } from "../booking/rebookBus";
import { getSalonFallbacks, createSalonBooking } from "../../shared/api/salons";
import { refreshApp } from "../../shared/lib/appRefresh";
import { shortServiceLabel } from "../../shared/lib/serviceBundle";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatRelativeBookingDayLabel } from "../../shared/lib/persianCalendar";
import { canRetryExpired, repeatRequestBody, requestedOf } from "./expiredRequest";

/**
 * Under a request that nobody answered in time («منقضی شده»): the way forward is on the card, not a dead end.
 *  - «همین نوبت را جای دیگر بگیر» (main): lists the places the client is connected to that do these services; a tap
 *    opens that place's booking form with the services, day and time already filled in.
 *  - «دوباره از همین سالن بپرس»: a fresh request for the same time, sent at once (the server checks it is still free
 *    and the client's limit on open requests).
 * Empty list: «هنوز جای دیگری وصل نکرده‌ای. شمارهٔ سالن یا آرتیست بعدی را بزن.» with the ways to connect.
 */
export function ExpiredRequestActions({ booking, clientName = "", onNotify, onFindPlaces, onOpenPlace, onClosePanel }) {
  const [sheet, setSheet] = useState(false);
  const [asking, setAsking] = useState(false);
  if (!canRetryExpired(booking)) return null;
  const place = booking.salonName || booking.salon_name || "سالن";

  async function askAgain() {
    if (asking) return;
    setAsking(true);
    try {
      const { ok, payload } = await createSalonBooking(repeatRequestBody(booking));
      if (ok) {
        onNotify?.(`درخواست تازه برای ${place} ارسال شد.`);
        void refreshApp();
      } else {
        // The server's own words (limit on open requests, hour taken, salon closed …); the other button is still there.
        onNotify?.(payload?.error || "درخواست ارسال نشد؛ دوباره امتحان کن.");
      }
    } catch {
      onNotify?.("درخواست ارسال نشد؛ اینترنتت را بررسی کن.");
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="erActions" role="group" aria-label={`راه بعدی برای ${shortServiceLabel(booking.service)}`}>
      <button type="button" className="erPrimary" onClick={() => setSheet(true)}>همین نوبت را جای دیگر بگیر</button>
      <button type="button" className="erSecondary" disabled={asking} onClick={askAgain}>
        {asking ? "در حال ارسال…" : "دوباره از همین سالن بپرس"}
      </button>
      {sheet ? (
        <PlacesSheet
          booking={booking}
          clientName={clientName}
          onClose={() => setSheet(false)}
          onNotify={onNotify}
          onFindPlaces={onFindPlaces}
          onOpenPlace={onOpenPlace}
          onPicked={() => { setSheet(false); onClosePanel?.(); }}
        />
      ) : null}
    </div>
  );
}

function PlacesSheet({ booking, clientName, onClose, onNotify, onFindPlaces, onOpenPlace, onPicked }) {
  const [state, setState] = useState({ status: "loading", places: [] });
  const { names, people } = requestedOf(booking);
  const day = booking.booking_date || booking.date || "";
  useEffect(() => {
    let alive = true;
    // The connected places that do every one of these services (no hour given: the form shows each place's own free hours).
    getSalonFallbacks(booking.salon_user_id, day, "", names)
      .then(({ ok, data }) => { if (alive) setState(ok ? { status: "ready", places: data?.salons || [] } : { status: "error", places: [] }); })
      .catch(() => { if (alive) setState({ status: "error", places: [] }); });
    return () => { alive = false; };
    // The booking is the same for as long as the sheet is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const when = `${day ? formatRelativeBookingDayLabel(day) : ""} ${booking.time ? toPersianDigits(booking.time) : ""}`.trim();
  return (
    <ProfileSheet open kicker="نوبت بی‌جواب" title="همین نوبت را جای دیگر بگیر" panelClassName="erSheet" onClose={onClose}>
      <div className="erBody">
        <p className="erSummary">{shortServiceLabel(booking.service)}{when ? `، ${when}` : ""}</p>
        {state.status === "loading" ? <p className="erInfo" role="status">در حال پیدا کردن جاهایی که این خدمت را دارند…</p> : null}
        {state.status === "error" ? (
          <p className="erInfo is-error" role="alert">فهرست بارگیری نشد؛ دوباره امتحان کن.</p>
        ) : null}
        {state.status === "ready" && state.places.length ? (
          <ul className="erPlaces" aria-label="جاهای وصل‌شده">
            {state.places.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="erPlace"
                  onClick={() => {
                    requestBookElsewhere({ place: { ...item, type: "salon" }, prefill: { names, day, time: booking.time, people } });
                    onPicked();
                  }}
                >
                  <b>{item.name}</b>
                  {item.area ? <small>{item.area}</small> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {state.status === "ready" && !state.places.length ? (
          <div className="erEmpty">
            <p role="status">هنوز جای دیگری وصل نکرده‌ای. شمارهٔ سالن یا آرتیست بعدی را بزن.</p>
            <AddPlaceActions
              clientName={clientName}
              onNotify={onNotify}
              onOpenPlace={(profile) => { onOpenPlace?.(profile); onPicked(); }}
              onFindPlaces={() => { onFindPlaces?.(); onPicked(); }}
              onDone={onClose}
            />
          </div>
        ) : null}
      </div>
    </ProfileSheet>
  );
}
