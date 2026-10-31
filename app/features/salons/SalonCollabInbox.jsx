"use client";

import { Check, X } from "lucide-react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { toPersianDigits } from "../../shared/lib/digits";
import { shortServiceLabel } from "../../shared/lib/serviceBundle";
import { SalonTermsRequestCard } from "./SalonTermsRequestCard";
import { useSalonTermsAnswer } from "./useSalonTermsAnswer";

/**
 * Artists asking to join, at the top of the salon's «پرسنل» (owner's decision 2026-10-30: it used to sit above the
 * bookings, where the owner never found it). A request with terms (from the join page) is answered on its own card
 * (قبول / رد / پیشنهاد خودم); older flat proposals keep the plain تأیید / رد row.
 */
export function SalonCollabInbox({ requests = [], busyId = "", onApprove, onDecline, onChanged }) {
  const termsAnswers = useSalonTermsAnswer({ onChanged });
  if (!requests.length) return null;
  const anyBusy = Boolean(busyId) || Boolean(termsAnswers.busyId);

  return (
    <section className="salonCollabInbox" id="salon-collab-inbox" aria-label="آرتیست‌هایی که می‌خوان بیان توی تیمت">
      <div className="boardHead">
        <div>
          <span>پیشنهاد همکاری</span>
          <strong>آرتیست‌هایی که می‌خوان با سالنت کار کنن</strong>
        </div>
        <b>{toPersianDigits(requests.length)} تازه</b>
      </div>
      <div className="salonCollabInboxList">
        {requests.map((request) => {
          if (request.terms) {
            return (
              <SalonTermsRequestCard
                key={request.id}
                request={request}
                busy={termsAnswers.busyId === String(request.id)}
                anyBusy={anyBusy}
                error={termsAnswers.errorFor(request.id)}
                onAnswer={termsAnswers.answer}
                onClearError={termsAnswers.clearError}
              />
            );
          }
          const busy = String(busyId) === `collab:${request.id}`;
          return (
            <article className="salonCollabInboxCard" key={request.id}>
              <div className="salonCollabArtist">
                <span className={`salonCollabAvatar ${request.artistAvatar ? "hasImage" : ""}`} aria-hidden="true">
                  {request.artistAvatar ? <img src={request.artistAvatar} alt="" /> : String(request.artistName || "آ").slice(0, 1)}
                </span>
                <div>
                  <strong>{request.artistName}</strong>
                  <small>{request.artistService || request.artistArea || "آرتیست frfro"}</small>
                </div>
              </div>
              <div className="salonCollabDeal">
                <b className="svcInline"><ServiceIcon emoji={request.service_emoji} name={request.service} size="xs" />{shortServiceLabel(request.service)}</b>
                <span>{request.days}</span>
                <em>{request.from} تا {request.to}، {request.capacity} نفر در روز</em>
              </div>
              <div className="salonCollabSharePill">
                <b>{request.share}٪</b>
                <span>سهم آرتیست</span>
              </div>
              <div className="requestActions">
                <button type="button" className="is-approve" disabled={anyBusy} onClick={() => onApprove?.(request.id)}>
                  <Check size={15} />
                  {busy ? "…" : "تأیید"}
                </button>
                <button type="button" className="is-decline" disabled={anyBusy} onClick={() => onDecline?.(request.id)}>
                  <X size={15} />
                  رد
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
