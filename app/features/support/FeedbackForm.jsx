"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { apiFetch } from "../../shared/api/client";
import { FEEDBACK_KINDS, sectionsFor } from "../../shared/lib/feedback";

const WORDS = ["", "خیلی بد", "بد", "معمولی", "خوب", "عالی"];

/**
 * «نظر و پیشنهاد»: pick a part of frfro, say what it was, give optional stars, write what happened. Sending it opens the
 * new support chat at once (onSent gets the ticket id), so the person lands where every later answer will come.
 */
export function FeedbackForm({ role, onSent }) {
  const [section, setSection] = useState("");
  const [kind, setKind] = useState("");
  const [stars, setStars] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ready = Boolean(section && kind && text.trim().length >= 3);

  async function submit(event) {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    let result;
    try {
      result = await apiFetch("/api/support", { method: "POST", body: JSON.stringify({ category: "feedback", section, kind, stars: stars || null, message: text.trim() }) });
    } catch {
      result = { ok: false, payload: { error: "اینترنتت وصل نیست؛ یه نگاه بنداز و دوباره بزن." } };
    }
    setBusy(false);
    if (result.ok) onSent(result.payload.data.id);
    else setError(result.payload?.error || "نرفت؛ دوباره بزن.");
  }

  return (
    <form className="scBody supForm" onSubmit={submit}>
      <div className="supField">
        <span id="fbSectionLabel">دربارهٔ کدوم بخش؟</span>
        <div className="supChips" role="radiogroup" aria-labelledby="fbSectionLabel">
          {sectionsFor(role).map((item) => (
            <button key={item} type="button" role="radio" aria-checked={section === item} className={section === item ? "is-on" : ""} onClick={() => setSection(item)}>{item}</button>
          ))}
        </div>
      </div>
      <div className="supField">
        <span id="fbKindLabel">چی بود؟</span>
        <div className="supChips" role="radiogroup" aria-labelledby="fbKindLabel">
          {FEEDBACK_KINDS.map((item) => (
            <button key={item} type="button" role="radio" aria-checked={kind === item} className={kind === item ? "is-on" : ""} onClick={() => setKind(item)}>{item}</button>
          ))}
        </div>
      </div>
      <div className="supField">
        <span id="fbStarsLabel">به این بخش چند ستاره می‌دی؟ (اگه خواستی)</span>
        <div className="fbStars" role="radiogroup" aria-labelledby="fbStarsLabel" dir="ltr">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} ستاره`} className={n <= stars ? "is-on" : ""} onClick={() => setStars(stars === n ? 0 : n)}>
              <Star size={28} aria-hidden="true" />
            </button>
          ))}
        </div>
        {stars ? <small className="fbStarsWord">{WORDS[stars]}</small> : null}
      </div>
      <label className="supField">
        <span>بنویس چی شد</span>
        <textarea rows={4} value={text} maxLength={1000} onChange={(event) => setText(event.target.value)} placeholder="مثلاً: وقتی نوبت رو عوض کردم، مشتری خبردار نشد." />
      </label>
      {error ? <p className="supError" role="alert">{error}</p> : null}
      <button type="submit" className="supBtn" disabled={!ready || busy}>{busy ? "دارم می‌فرستم…" : "بفرست"}</button>
    </form>
  );
}
