"use client";

import { useState } from "react";
import { TermsProposalSheet } from "../team/TermsProposalSheet";
import { diffRows } from "../team/TeamTermsCard";
import { termsSummary } from "./joinTermsFormat";

/**
 * An artist's request to join with terms, in the salon's «درخواست‌ها»: what she changed (قبل ← بعد, as on the team terms card),
 * her line in quotes, and the three answers. Requests without `terms` are the older flat ones and render as before.
 * `request.terms` is what she asks, `request.baseTerms` what the salon had when she asked (the salon's terms may move on).
 */
export function SalonTermsRequestCard({ request, busy, anyBusy, error, onAnswer, onClearError }) {
  const [counter, setCounter] = useState(false);
  const rows = request.baseTerms ? diffRows(request.baseTerms, request.terms) : [];
  const name = request.artistName || "آرتیست";

  return (
    <article className="jtAnswer ttProposal is-live">
      <div className="jtAnswerWho">
        <span className={`salonCollabAvatar ${request.artistAvatar ? "hasImage" : ""}`} aria-hidden="true">
          {request.artistAvatar ? <img src={request.artistAvatar} alt="" /> : String(name).slice(0, 1)}
        </span>
        <div>
          <strong>{name}</strong>
          <small>{request.artistService || request.artistArea || "آرتیست frfro"}</small>
        </div>
        <span className="ttChip">پیشنهاد تازه</span>
      </div>

      {rows.length ? (
        <div className="ttDiff">
          {rows.map(([label, before, after]) => <div key={label}><span>{label}</span><s>{before}</s><b>{after}</b></div>)}
        </div>
      ) : (
        <p className="ttNoteText">{request.baseTerms ? "همون شرایط تو رو قبول داره." : termsSummary(request.terms)}</p>
      )}
      {request.terms.note ? <p className="ttNoteText">«{request.terms.note}»</p> : null}
      <small>با قبول کردن، {name} وارد تیم می‌شه. ۷ روز اعتبار داره.</small>

      {error && !counter ? <p className="tsError" role="alert">{error}</p> : null}
      <div className="ttActions">
        <button type="button" className="is-red" disabled={anyBusy} onClick={() => onAnswer(request, "reject")}>نمی‌پذیرم</button>
        <button type="button" className="is-soft" disabled={anyBusy} onClick={() => { onClearError?.(); setCounter(true); }}>پیشنهاد خودم</button>
        <button type="button" className="is-pink" disabled={anyBusy} onClick={() => onAnswer(request, "accept")}>{busy ? "…" : "می‌پذیرم"}</button>
      </div>

      <TermsProposalSheet
        mode="counter"
        open={counter}
        otherName={name}
        initial={request.terms}
        busy={busy}
        error={error}
        onClose={() => { setCounter(false); onClearError?.(); }}
        onSend={async (terms) => { if (await onAnswer(request, "counter", terms)) setCounter(false); }}
      />
    </article>
  );
}
