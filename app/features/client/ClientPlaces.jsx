"use client";

import { SkeletonList } from "../../components/Skeleton";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, LayoutGrid, Plus, RotateCcw, Store, UserRound } from "lucide-react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { Mascot } from "../../components/Mascot";
import { listConnections } from "../../shared/api/connections";
import { useAppRefresh } from "../../shared/lib/appRefresh";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatTomanNumber, parseTomanAmount } from "../../shared/lib/money";
import { formatRelativeBookingDayLabel, getPersianWeekday } from "../../shared/lib/persianCalendar";
import { shortServiceLabel } from "../../shared/lib/serviceBundle";
import { ConnectSheet } from "../connect/ConnectSheet";
import { AddPlaceActions } from "./AddPlaceActions";
import { isBookingAhead } from "./bookingStatus";

const SHOWN_SERVICES = 4;

/** The salon or artist a booking row belongs to, as a connection id. */
function placeIdOf(booking) {
  return String(booking?.bookingSource === "artist"
    ? booking.artistUserId || booking.sourceArtistUserId || ""
    : booking?.salon_user_id || booking?.sourceSalonUserId || "");
}

/** Newest first, by id within each source (ids are per table) then by when it was made. */
function newestFirst(a, b) {
  const at = String(a.created_at || "");
  const bt = String(b.created_at || "");
  if (at !== bt) return bt.localeCompare(at);
  return Number(b.id || 0) - Number(a.id || 0);
}

function todayStatus(place) {
  const hours = Array.isArray(place?.hours) ? place.hours : [];
  if (!hours.length) return null;
  const today = hours.find((row) => row.day === getPersianWeekday(new Date()));
  if (!today?.active) return { open: false, text: "امروز تعطیله" };
  return { open: true, text: `امروز تا ${toPersianDigits(today.close_time || "")} بازه` };
}

function serviceMeta(service) {
  const price = parseTomanAmount(service.price);
  return [
    service.duration ? toPersianDigits(service.duration) : "",
    price ? `${formatTomanNumber(price)} تومان` : ""
  ].filter(Boolean).join(" · ");
}

function Avatar({ place, size = "md" }) {
  return (
    <span className={`chAvatar is-${size}`} aria-hidden="true">
      {place.avatar
        ? <img src={place.avatar} alt="" style={{ objectPosition: place.avatarPosition || "50% 50%" }} />
        : String(place.name || "؟").slice(0, 1)}
    </span>
  );
}

/**
 * The «رزرو» tab's first tab, «سالن و آرتیست من»: the salons and artists the client follows, each with
 * its services, so a booking starts in one tap — «دوباره همان خدمت» or any service. The place the
 * client booked with last comes first. Finding someone new is the other tab (`onFindPlaces`).
 */
export function ClientPlaces({ bookings = [], clientName = "", onOpenPlace, onFindPlaces, onNotify }) {
  const [places, setPlaces] = useState(null); // null = loading
  const [activeId, setActiveId] = useState("");
  const [adding, setAdding] = useState(false); // the «افزودن» sheet, once there is already a place

  const load = useCallback(async () => {
    const { ok, data } = await listConnections({ withServices: true });
    if (ok) setPlaces(Array.isArray(data?.connections) ? data.connections : []);
    else setPlaces((current) => current || []);
  }, []);
  useEffect(() => { load(); }, [load]);
  useAppRefresh(load);

  // The place the client booked with last comes first; the rest keep the order they were added in.
  const lastBookingByPlace = useMemo(() => {
    const map = new Map();
    [...bookings].sort(newestFirst).forEach((booking) => {
      const id = placeIdOf(booking);
      if (id && !map.has(id)) map.set(id, booking);
    });
    return map;
  }, [bookings]);
  // «دوباره همان خدمت» comes from a visit that is behind the client, not one still ahead.
  const lastVisitByPlace = useMemo(() => {
    const map = new Map();
    [...bookings].sort(newestFirst).forEach((booking) => {
      const id = placeIdOf(booking);
      const ahead = isBookingAhead(booking);
      if (id && !ahead && !map.has(id)) map.set(id, booking);
    });
    return map;
  }, [bookings]);

  const ordered = useMemo(() => {
    if (!places) return [];
    const rank = [...lastBookingByPlace.keys()];
    const score = (place) => {
      const index = rank.indexOf(String(place.id));
      return index === -1 ? rank.length : index;
    };
    // Then the ones a booking can start from (they have services) before the empty ones.
    const empty = (place) => ((place.serviceCount || 0) > 0 ? 0 : 1);
    return [...places].sort((a, b) => score(a) - score(b) || empty(a) - empty(b));
  }, [places, lastBookingByPlace]);

  const active = ordered.find((place) => String(place.id) === activeId) || ordered[0] || null;

  const firstTime = places !== null && !active;

  return (
    <div className="clientHome is-places">
      <section className="chPlaces" aria-label="سالن و آرتیست من">
        <div className="chHead">
          <div>
            <span>سالن و آرتیست‌هام</span>
            <strong>{active ? "از همین‌جا نوبت بگیر" : "نوبت گرفتن از اینجا شروع می‌شه"}</strong>
          </div>
          {ordered.length ? (
            <button type="button" className="chHeadBtn" onClick={() => setAdding(true)}>
              <Plus size={16} aria-hidden="true" />
              <span>افزودن</span>
            </button>
          ) : null}
        </div>

        {places === null ? (
          <SkeletonList rows={3} variant="row" label="در حال بارگذاری" />
        ) : firstTime ? (
          <div className="chCard chEmpty">
            <Mascot pose="connect" size={96} className="chEmptyMascot" />
            <b>سالن یا آرتیستت رو وصل کن</b>
            <AddPlaceActions
              clientName={clientName}
              onConnected={load}
              onOpenPlace={onOpenPlace}
              onFindPlaces={onFindPlaces}
              onNotify={onNotify}
            />
          </div>
        ) : (
          <>
            {ordered.length > 1 ? (
              <div className="chSwitch" role="tablist" aria-label="انتخاب سالن یا آرتیست">
                {ordered.map((place) => {
                  const selected = String(place.id) === String(active.id);
                  return (
                    <button
                      key={place.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      className={selected ? "is-on" : ""}
                      onClick={() => setActiveId(String(place.id))}
                    >
                      <Avatar place={place} size="xs" />
                      <span>{place.name}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            <PlaceCard
              key={active.id}
              place={active}
              lastBooking={lastVisitByPlace.get(String(active.id)) || null}
              onOpenPlace={onOpenPlace}
            />
          </>
        )}
      </section>

      {adding ? (
        <ConnectSheet label="افزودن سالن یا آرتیست" title="سالن یا آرتیستت رو وصل کن" onClose={() => setAdding(false)}>
          <AddPlaceActions
            clientName={clientName}
            onConnected={load}
            onOpenPlace={onOpenPlace}
            onFindPlaces={onFindPlaces}
            onNotify={onNotify}
            onDone={() => setAdding(false)}
          />
        </ConnectSheet>
      ) : null}

    </div>
  );
}

function PlaceCard({ place, lastBooking, onOpenPlace }) {
  const status = todayStatus(place);
  const services = Array.isArray(place.services) ? place.services : [];
  const shown = services.slice(0, SHOWN_SERVICES);
  const total = Math.max(place.serviceCount || 0, services.length);
  const kind = place.type === "artist" ? "آرتیست" : "سالن";
  const KindIcon = place.type === "artist" ? UserRound : Store;
  // «دوباره همان خدمت»: only for a single service the place still offers.
  const lastService = lastBooking ? String(lastBooking.service || "").trim() : "";
  const repeatService = lastService && !lastService.includes(" + ") && services.some((service) => service.name === lastService)
    ? lastService
    : "";
  const book = (names, label) => onOpenPlace?.(place, { services: names, label });

  return (
    <article className="chCard chPlace">
      <button type="button" className="chPlaceTop" onClick={() => onOpenPlace?.(place)} aria-label={`صفحهٔ ${place.name}`}>
        <Avatar place={place} size="lg" />
        <span className="chPlaceText">
          <b>{place.name}</b>
          <small>
            <KindIcon size={13} aria-hidden="true" />
            {kind}{place.area ? ` · ${place.area}` : ""}
          </small>
          {status ? <em className={status.open ? "is-open" : "is-closed"}><i aria-hidden="true" />{status.text}</em> : null}
        </span>
        <ChevronLeft size={20} aria-hidden="true" className="chChevron" />
      </button>

      {repeatService ? (
        <button type="button" className="chRepeat" onClick={() => book([repeatService], repeatService)}>
          <RotateCcw size={18} aria-hidden="true" />
          <span>
            <b>دوباره «{shortServiceLabel(repeatService)}»</b>
            <small>آخرین بار {formatRelativeBookingDayLabel(lastBooking.booking_date || lastBooking.date || "امروز")}؛ فقط روز و ساعت رو انتخاب کن</small>
          </span>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
      ) : null}

      {shown.length ? (
        <ul className="chServices" aria-label={`خدمات ${place.name}`}>
          {shown.map((service) => (
            <li key={service.name}>
              <button type="button" onClick={() => book([service.name], service.name)}>
                <ServiceIcon emoji={service.emoji} name={service.name} size="sm" />
                <span className="chSvcText">
                  <b>{service.name}</b>
                  {serviceMeta(service) ? <small>{serviceMeta(service)}</small> : null}
                </span>
                <span className="chSvcBook">رزرو</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="chNoServices">هنوز خدمتی نذاشته؛ صفحه‌ش رو ببین یا زنگ بزن.</p>
      )}

      {total ? (
        <button type="button" className="chAll" onClick={() => book([], "همه خدمات")}>
          <LayoutGrid size={17} aria-hidden="true" />
          <span>{total > shown.length ? `همهٔ خدمت‌ها (${toPersianDigits(total)})` : "چند کار با هم، توی یه نوبت"}</span>
          <ChevronLeft size={17} aria-hidden="true" />
        </button>
      ) : (
        <button type="button" className="chAll" onClick={() => onOpenPlace?.(place)}>
          <KindIcon size={17} aria-hidden="true" />
          <span>دیدن صفحهٔ {place.name}</span>
          <ChevronLeft size={17} aria-hidden="true" />
        </button>
      )}
    </article>
  );
}
