"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Percent, Timer } from "lucide-react";
import { answerTeamTerms, getTeamTerms, proposeTeamTerms } from "../../shared/api/team";
import { toPersianDigits } from "../../shared/lib/digits";
import { TermsProposalSheet } from "./TermsProposalSheet";
import { keyLabel } from "./teamWeek";

const fmtHours = (terms) => (terms.from && terms.to ? `${toPersianDigits(terms.from)} تا ${toPersianDigits(terms.to)}` : "");
const fmtShare = (value) => (Number.isInteger(value) ? `${toPersianDigits(value)} درصد` : "");

/** One line of «قبل ← بعد» for what a proposal changes; nothing when it is the same. */
function diffRows(current, next) {
  const rows = [];
  if ((current.days || "") !== (next.days || "")) rows.push(["روزها", current.days || "—", next.days]);
  if (fmtHours(current) !== fmtHours(next)) rows.push(["ساعت", fmtHours(current) || "—", fmtHours(next)]);
  if (current.share !== next.share) rows.push(["سهم آرتیست", fmtShare(current.share) || "—", fmtShare(next.share)]);
  if ((current.ownShare ?? null) !== (next.ownShare ?? null)) rows.push(["مشتری خودش", fmtShare(current.ownShare ?? current.share) || "—", fmtShare(next.ownShare ?? next.share)]);
  return rows;
}

/**
 * «شرایط کار» of one team pair, for the salon (on a member's page) and the artist (under the salon's card): what stands now,
 * what is agreed to start later, a proposal waiting for an answer (to accept, reject or counter) and the button to propose
 * a change (owner's decision 2026-10-28). Until a proposal is accepted the old terms stand.
 */
export function TeamTermsCard({ pair, otherName, onChanged }) {
  const [state, setState] = useState(null);
  const [sheet, setSheet] = useState(false);
  const [counter, setCounter] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const key = JSON.stringify(pair);

  const load = useCallback(async () => {
    try {
      const result = await getTeamTerms(JSON.parse(key));
      if (result.ok) setState(result.data);
    } catch {
      // the card stays empty until it loads
    }
  }, [key]);
  useEffect(() => { load(); }, [load]);

  if (!state) return null;
  const { side, current, upcoming, pending } = state;
  const theirs = pending && pending.by !== side;
  const mine = pending && pending.by === side;
  const nothing = !current.days && !current.from && !Number.isInteger(current.share);

  async function send(terms) {
    setBusy(true);
    setError("");
    try {
      const result = await proposeTeamTerms(pair, terms);
      if (!result.ok) { setError(result.payload?.error || "نرفت؛ دوباره بزن."); return; }
      setState(result.data);
      setSheet(false);
      setCounter(null);
      setNotice(`پیشنهادت رفت برای ${otherName}.`);
      onChanged?.();
    } catch {
      setError("نرفت؛ اینترنتت رو یه نگاه بنداز و دوباره بزن.");
    } finally {
      setBusy(false);
    }
  }

  async function answer(action) {
    setBusy(true);
    setError("");
    try {
      const result = await answerTeamTerms(pair, pending.id, action);
      if (!result.ok) { setError(result.payload?.error || "نشد؛ دوباره بزن."); await load(); return; }
      setState(result.data);
      setNotice(action === "accept" ? "قبول کردی؛ شرایط تازه از روز شروعش اجرا می‌شه." : action === "reject" ? "قبول نکردی؛ شرایط قبلی می‌مونه." : "پیشنهادت برداشته شد.");
      onChanged?.();
    } catch {
      setError("نشد؛ اینترنتت رو یه نگاه بنداز و دوباره بزن.");
    } finally {
      setBusy(false);
    }
  }

  const rows = pending ? diffRows(current, pending) : [];
  return (
    <section className="ttCard" aria-label="شرایط کار">
      <div className="ttHead"><b>شرایط کار</b>{current.effectiveFrom ? <small>از {keyLabel(current.effectiveFrom)}</small> : null}</div>
      {nothing && !upcoming ? (
        <p className="ttNone">هنوز شرایطی ثبت نشده. روز، ساعت و درصد رو پیشنهاد بده تا حساب و کتاب بتونه حساب کنه.</p>
      ) : nothing ? null : (
        <div className="ttRows">
          <div><CalendarDays size={15} aria-hidden="true" /><span>روزها</span><b>{current.days || "—"}</b></div>
          <div><Timer size={15} aria-hidden="true" /><span>ساعت</span><b>{fmtHours(current) || "—"}</b></div>
          <div><Percent size={15} aria-hidden="true" /><span>سهم آرتیست</span><b>{fmtShare(current.share) || "مشخص نیست"}</b></div>
          {Number.isInteger(current.ownShare) ? <div><Percent size={15} aria-hidden="true" /><span>مشتری خودش</span><b>{fmtShare(current.ownShare)}</b></div> : null}
        </div>
      )}
      {upcoming ? <p className="ttSoon">از {keyLabel(upcoming.effectiveFrom)} اجرا می‌شه: {upcoming.days}، {fmtHours(upcoming)}، {fmtShare(upcoming.share)}.</p> : null}

      {theirs ? (
        <div className="ttProposal is-live">
          <span className="ttChip">پیشنهاد تازهٔ {otherName}</span>
          <div className="ttDiff">
            {rows.map(([label, before, after]) => <div key={label}><span>{label}</span><s>{before}</s><b>{after}</b></div>)}
            {!rows.length ? <p>همین شرایط، فقط با روز شروع تازه.</p> : null}
          </div>
          {pending.note ? <p className="ttNoteText">«{pending.note}»</p> : null}
          <small>از {keyLabel(pending.effectiveFrom)} اجرا می‌شه. تا جواب ندی، شرایط قبلی می‌مونه.</small>
          <div className="ttActions">
            <button type="button" className="is-red" disabled={busy} onClick={() => answer("reject")}>نمی‌پذیرم</button>
            <button type="button" className="is-soft" disabled={busy} onClick={() => setCounter(pending)}>پیشنهاد خودم</button>
            <button type="button" className="is-pink" disabled={busy} onClick={() => answer("accept")}>می‌پذیرم</button>
          </div>
        </div>
      ) : null}

      {mine ? (
        <div className="ttProposal">
          <span className="ttChip is-soft">منتظر جواب {otherName}</span>
          <div className="ttDiff">{rows.map(([label, before, after]) => <div key={label}><span>{label}</span><s>{before}</s><b>{after}</b></div>)}</div>
          <button type="button" className="ttLink" disabled={busy} onClick={() => answer("cancel")}>پیشنهادم رو بردار</button>
        </div>
      ) : null}

      {!theirs ? <button type="button" className="ttPropose" onClick={() => { setError(""); setSheet(true); }}>{mine ? "پیشنهاد دیگه‌ای بده" : "پیشنهاد تغییر"}</button> : null}
      {notice ? <p className="ttNotice" role="status">{notice}</p> : null}
      {error && !sheet && !counter ? <p className="tsError" role="alert">{error}</p> : null}

      <TermsProposalSheet open={sheet || Boolean(counter)} otherName={otherName} initial={counter || current} busy={busy} error={error} onSend={send} onClose={() => { setSheet(false); setCounter(null); setError(""); }} />
    </section>
  );
}
