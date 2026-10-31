"use client";

import { useState } from "react";
import { CalendarDays, Clock3, Sunrise } from "lucide-react";
import { TermsProposalSheet } from "../../features/team/TermsProposalSheet";
import { daysText, hoursText, percentText } from "../../features/salons/joinTermsFormat";
import { toPersianDigits } from "../../shared/lib/digits";

const RULES_SHOWN = 4;
const PROMISE = [
  "تا قبول نکنی، نوبتی بهت نمی‌رسه.",
  "تغییر شرایط فقط با موافقت هر دو و حداقل ۷ روز بعد.",
  "ترک تیم هر وقت؛ نوبت‌های ۲۴ ساعت آینده رو انجام می‌دی، بقیه واگذار یا با اطلاع مشتری لغو می‌شه."
];

/**
 * The body of the join «برگه»: «سهم تو» as a big number with days / hours / «از امروز» chips, the salon's rules (four lines,
 * the rest behind «بقیه»), one calm line with «قول فرفرو», and the two answers. A guest sees the same paper; the accept
 * button then signs her in first. `onPropose` gets { days, from, to, share, ownShare, note } from the shared proposal sheet.
 */
export function JoinTermsSheet({ salonName, terms, rulesLines, guest, busy, notice, onAccept, onPropose }) {
  const [allRules, setAllRules] = useState(false);
  const [promise, setPromise] = useState(false);
  const [proposing, setProposing] = useState(false);
  const shownRules = allRules ? rulesLines : rulesLines.slice(0, RULES_SHOWN);
  const hidden = rulesLines.length - RULES_SHOWN;
  const hours = hoursText(terms.from, terms.to);
  const canPropose = terms.allowProposals !== false && !guest;

  return (
    <div className="jpBody">
      <section className="jpShare" aria-label="سهم تو">
        <small>سهم تو</small>
        <strong>{percentText(terms.share)}</strong>
        {Number.isInteger(terms.ownShare) ? <em>از مشتری‌هایی که خودت میاری: {percentText(terms.ownShare)}</em> : null}
        <div className="jpChips">
          <span><CalendarDays size={14} aria-hidden="true" />{daysText(terms.days)}</span>
          {hours ? <span><Clock3 size={14} aria-hidden="true" />{hours}</span> : null}
          <span className="is-live"><Sunrise size={14} aria-hidden="true" />از امروز</span>
        </div>
      </section>

      {rulesLines.length ? (
        <section className="jpRules" aria-label="قوانین سالن">
          <h2>قوانین سالن</h2>
          <ul>
            {shownRules.map((line, index) => <li key={index}>{line}</li>)}
          </ul>
          {hidden > 0 ? (
            <button type="button" className="jpMore" aria-expanded={allRules} onClick={() => setAllRules((value) => !value)}>
              {allRules ? "کمتر" : `بقیه (${toPersianDigits(hidden)})`}
            </button>
          ) : null}
        </section>
      ) : null}

      <div className="jpCalm">
        <p>
          تغییر فقط با موافقت هر دو. هر وقت خواستی می‌تونی از تیم بری.{" "}
          <button type="button" aria-expanded={promise} onClick={() => setPromise((value) => !value)}>قول فرفرو</button>
        </p>
        {promise ? <ul>{PROMISE.map((line) => <li key={line}>{line}</li>)}</ul> : null}
      </div>

      {notice ? <p className="joinSalonHint is-warning jpNotice" role="alert">{notice}</p> : null}

      <div className="jpActions">
        <button type="button" className="jpAccept" disabled={busy} onClick={onAccept}>
          {busy ? "یه لحظه…" : guest ? "قبول دارم، وارد می‌شم" : "قبول دارم"}
        </button>
        {canPropose ? (
          <button type="button" className="jpOffer" disabled={busy} onClick={() => setProposing(true)}>پیشنهاد خودم رو می‌دم</button>
        ) : !guest ? (
          <p className="jpFixed">این سالن شرایطش رو عوض نمی‌کنه. قبول نکنی هم مشکلی نیست.</p>
        ) : null}
      </div>

      <TermsProposalSheet
        mode="join"
        open={proposing}
        otherName={salonName}
        initial={terms}
        busy={busy}
        onClose={() => setProposing(false)}
        onSend={(proposal) => { setProposing(false); onPropose(proposal); }}
      />
    </div>
  );
}
