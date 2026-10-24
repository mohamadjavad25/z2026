"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { getArtistPlace, saveArtistPlace } from "../../shared/api/artists";
import { getApiErrorMessage } from "../../shared/lib/apiNotify";

const SAVED_MESSAGE = "ذخیره شد. از الان نوبت‌ها همین‌طور جا می‌گیرن.";
const FALLBACKS = [
  { id: "own", title: "مثل قبل", hint: "نوبت مثل همیشه برگزار می‌شه." },
  { id: "ask", title: "بهم خبر بده", hint: "نوبت منتظر می‌مونه تا جاش رو تو بگی." }
];

const mark = (name) => String(name || "س").trim().slice(0, 1) || "س";

/**
 * Artist on one or more salon teams — «نوبت مشتری‌هام کجا باشه؟» (owner's idea of 2026-10-24). The client only picks a
 * day and an hour. The artist keeps an ordered list of their salons; a booking goes to the first one that can take it,
 * and when none can it stays «مثل قبل» or waits for the artist's word. Nothing changes until they save.
 */
export function ArtistPlaceChooser() {
  const [state, setState] = useState("loading"); // loading | ready | none | error
  const [saved, setSaved] = useState({ order: [], fallback: "own" });
  const [teams, setTeams] = useState([]);
  const [order, setOrder] = useState([]);
  const [fallback, setFallback] = useState("own");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ tone: "", text: "" });

  const apply = useCallback((place) => {
    const inList = place.teams.filter((team) => team.inList).map((team) => team.salonId);
    setTeams(place.teams);
    setSaved({ order: inList, fallback: place.fallback });
    setOrder(inList);
    setFallback(place.fallback);
  }, []);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const { ok, data } = await getArtistPlace();
      if (!ok) { setState("error"); return; }
      if (!data?.place?.teams?.length) { setState("none"); return; }
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

  const byId = new Map(teams.map((team) => [team.salonId, team]));
  const listed = order.map((id) => byId.get(id)).filter(Boolean);
  const spare = teams.filter((team) => !order.includes(team.salonId));
  const dirty = fallback !== saved.fallback || order.join(",") !== saved.order.join(",");
  const fallbackHint = FALLBACKS.find((item) => item.id === fallback)?.hint || "";

  const touch = (next) => { setMessage({ tone: "", text: "" }); setOrder(next); };
  const move = (index, step) => {
    const next = [...order];
    const to = index + step;
    if (to < 0 || to >= next.length) return;
    [next[index], next[to]] = [next[to], next[index]];
    touch(next);
  };

  async function save() {
    if (busy || !dirty) return;
    setBusy(true);
    setMessage({ tone: "", text: "" });
    try {
      const { ok, payload } = await saveArtistPlace({ order, fallback });
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
        <b>نوبت مشتری‌هام کجا باشه؟</b>
        <small>مشتری فقط ساعت می‌گیره. هر نوبت می‌ره سراغ اولین سالنی که جا داره.</small>
      </header>

      {listed.length ? (
        <ol className="plList" aria-label="سالن‌ها به ترتیب">
          {listed.map((team, index) => (
            <li key={team.salonId} className={`plRow${team.note ? " is-skipped" : ""}`}>
              <span className="plNum" aria-hidden="true">{index + 1}</span>
              <span className="plAv" aria-hidden="true">{mark(team.name)}</span>
              <span className="plText">
                <b>{team.name}</b>
                <small>{team.note || team.area || "سالن"}</small>
              </span>
              <span className="plTools">
                <button type="button" aria-label={`${team.name} رو بالاتر ببر`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={15} /></button>
                <button type="button" aria-label={`${team.name} رو پایین‌تر ببر`} disabled={index === listed.length - 1} onClick={() => move(index, 1)}><ArrowDown size={15} /></button>
                <button type="button" aria-label={`${team.name} رو از فهرست بردار`} onClick={() => touch(order.filter((id) => id !== team.salonId))}><X size={15} /></button>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="plHint">هنوز سالنی اضافه نکردی. همه نوبت‌ها مثل قبل می‌مونن.</p>
      )}

      {spare.map((team) => (
        <button type="button" key={team.salonId} className="plAdd" onClick={() => touch([...order, team.salonId])}>
          <Plus size={16} aria-hidden="true" />
          <span><b>{team.name}</b>{team.area ? <small>{team.area}</small> : null}</span>
          <em>اضافه کن</em>
        </button>
      ))}

      <div className="plLast">
        <b>اگه هیچ‌کدوم جا نداشت</b>
        <div className="plSeg" role="radiogroup" aria-label="اگه هیچ‌کدوم جا نداشت">
          {FALLBACKS.map((item) => (
            <button
              type="button"
              key={item.id}
              role="radio"
              aria-checked={fallback === item.id}
              className={fallback === item.id ? "is-on" : ""}
              onClick={() => { setFallback(item.id); setMessage({ tone: "", text: "" }); }}
            >{item.title}</button>
          ))}
        </div>
        <small>{fallbackHint}</small>
      </div>

      {message.text ? <p className={`plNote is-${message.tone}`} role="status">{message.text}</p> : null}

      <button type="button" className="plSave" disabled={busy || !dirty} onClick={save}>
        {busy ? "یه لحظه…" : "ذخیره"}
      </button>
    </section>
  );
}
