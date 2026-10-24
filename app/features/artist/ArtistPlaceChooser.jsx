"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, MapPin, Store, UserRound } from "lucide-react";
import { getArtistPlace, saveArtistPlace } from "../../shared/api/artists";
import { getApiErrorMessage } from "../../shared/lib/apiNotify";
import { PLACE_WEEKDAYS, plannedPlaces } from "../../shared/lib/artistPlace";
import { shortPersianWeekday } from "../../shared/lib/time";
import { openLocationSettings } from "../profile/locationEvents";

const SAVED_MESSAGE = "ذخیره شد. از الان مشتری‌هات همین‌طور نوبت می‌گیرن.";

/**
 * Artist on a salon team — «مشتری‌هات کجا نوبت بگیرن؟» (owner's idea of 2026-10-24). The artist picks where the clients who
 * book them straight from their page are received: at the salon, at their own place, or a place per weekday. The salon
 * only keeps a switch (SalonStaffProfileModal). Nothing changes until they save, and what was already booked stays.
 */
export function ArtistPlaceChooser() {
  const [place, setPlace] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | none | error
  const [mode, setMode] = useState("own");
  const [days, setDays] = useState(Array(7).fill("o"));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ tone: "", text: "" });

  const apply = useCallback((next) => {
    setPlace(next);
    setMode(next.mode);
    setDays(plannedPlaces(next.mode, next.days));
  }, []);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const { ok, data } = await getArtistPlace();
      if (!ok) { setState("error"); return; }
      if (!data?.place) { setState("none"); return; }
      apply(data.place);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [apply]);

  useEffect(() => { load(); }, [load]);

  if (state === "none") return null;
  if (state === "loading") return <section className="plBox is-loading" aria-busy="true" aria-label="جای نوبت‌ها" />;
  if (state === "error") {
    return (
      <section className="plBox" aria-label="جای نوبت‌ها">
        <p className="plNote is-warn">الان نشد بخونم. دوباره امتحان کن.</p>
        <button type="button" className="plGhost" onClick={load}>دوباره</button>
      </section>
    );
  }

  const salon = place.salonName || "سالن";
  const blocked = !place.allowed;
  const draftDays = mode === "salon" ? Array(7).fill("s") : mode === "own" ? Array(7).fill("o") : days;
  const dirty = mode !== place.mode || (mode === "days" && days.join("") !== place.days);
  const wantsOwn = draftDays.includes("o");
  const savedWantsSalon = plannedPlaces(place.mode, place.days).includes("s");
  const options = [
    { id: "salon", icon: Store, title: `توی ${salon}`, hint: "نوبت‌ها با ساعت سالن می‌خونن و مشتری آدرس سالن رو می‌بینه.", locked: blocked },
    { id: "own", icon: UserRound, title: "جای خودم", hint: "مشتری آدرس خودت رو می‌بینه. سالن فقط می‌بینه اون ساعت درگیری.", locked: false },
    { id: "days", icon: MapPin, title: "هر روز یه جا", hint: "مثلاً شنبه و دوشنبه سالن، بقیه جای خودم.", locked: false }
  ];

  function pickDay(index) {
    setMessage({ tone: "", text: "" });
    setDays((current) => current.map((value, i) => (i === index ? (value === "s" ? "o" : blocked ? "o" : "s") : value)));
  }

  async function save() {
    if (busy || !dirty) return;
    setBusy(true);
    setMessage({ tone: "", text: "" });
    try {
      const { ok, payload } = await saveArtistPlace({ salonUserId: place.salonId, mode, ...(mode === "days" ? { days: days.join("") } : {}) });
      if (!ok) {
        setMessage({ tone: "bad", text: getApiErrorMessage(payload, "ذخیره نشد؛ دوباره بزن.") });
        return;
      }
      if (payload?.data?.place) apply(payload.data.place);
      setMessage({ tone: "ok", text: SAVED_MESSAGE });
    } catch {
      setMessage({ tone: "bad", text: "ذخیره نشد؛ دوباره بزن." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="plBox" aria-label="جای نوبت‌ها">
      <header className="plHead">
        <b>مشتری‌هات کجا نوبت بگیرن؟</b>
        <small>خودت انتخاب کن. مشتری‌هات همین رو می‌بینن.</small>
      </header>

      <div className="plOpts" role="radiogroup" aria-label="جای نوبت‌ها">
        {options.map(({ id, icon: Icon, title, hint, locked }) => (
          <button
            type="button"
            key={id}
            role="radio"
            aria-checked={mode === id}
            disabled={locked}
            className={`plOpt${mode === id ? " is-on" : ""}`}
            onClick={() => { setMode(id); setMessage({ tone: "", text: "" }); }}
          >
            <span className="plOptIcon" aria-hidden="true"><Icon size={18} /></span>
            <span className="plOptText">
              <b>{title}</b>
              <small>{locked ? `${salon} نوبت مستقیم توی سالن رو بسته. با سالن هماهنگ کن.` : hint}</small>
            </span>
            <span className="plOptDot" aria-hidden="true">{mode === id ? <Check size={13} strokeWidth={3} /> : null}</span>
          </button>
        ))}
      </div>

      {mode === "days" ? (
        <div className="plWeekBlock">
          <p className="plHint">روی هر روز بزن تا بین «سالن» و «جای خودم» عوض شه.</p>
          <div className="plWeek" role="group" aria-label="جای هر روز">
            {PLACE_WEEKDAYS.map((day, index) => {
              const atSalon = days[index] === "s";
              const shut = atSalon && place.salonOpenDays?.[index] === false;
              return (
                <button
                  type="button"
                  key={day}
                  aria-pressed={atSalon}
                  aria-label={`${day}، ${atSalon ? "سالن" : "جای خودم"}${shut ? "، سالن تعطیله" : ""}`}
                  className={`plDay ${atSalon ? "is-salon" : "is-own"}${shut ? " is-shut" : ""}`}
                  onClick={() => pickDay(index)}
                >
                  <b>{shortPersianWeekday(day)}</b>
                  <small>{shut ? "تعطیل" : atSalon ? "سالن" : "خودم"}</small>
                </button>
              );
            })}
          </div>
          {draftDays.some((value, index) => value === "s" && place.salonOpenDays?.[index] === false) ? (
            <p className="plHint">روزهایی که سالن تعطیله، مشتری نمی‌تونه نوبت بگیره.</p>
          ) : null}
        </div>
      ) : null}

      {wantsOwn && !place.hasOwnAddress ? (
        <div className="plNote is-warn">
          <span>هنوز آدرس خودت رو نذاشتی. بذار تا مشتری بدونه کجا بیاد.</span>
          <button type="button" className="plGhost" onClick={openLocationSettings}>جام رو روی نقشه بذار</button>
        </div>
      ) : null}

      {blocked && savedWantsSalon ? (
        <p className="plNote is-bad">{salon} نوبت مستقیم رو بسته؛ مشتری‌هات الان نمی‌تونن روزهای سالن رو بگیرن. «جای خودم» رو بزن تا نوبت بگیرن.</p>
      ) : null}

      <p className="plHint">نوبت‌هایی که تا حالا گرفته شده سر جاشون می‌مونن.</p>

      {message.text ? <p className={`plNote is-${message.tone}`} role="status">{message.text}</p> : null}

      <button type="button" className="plSave" disabled={busy || !dirty} onClick={save}>
        {busy ? "یه لحظه…" : "ذخیره"}
      </button>
    </section>
  );
}
