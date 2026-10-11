"use client";

import { Check, Store, X } from "lucide-react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { SegmentClock } from "../../components/SegmentClock";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatRelativeBookingDayLabel } from "../../shared/lib/persianCalendar";
import { shortServiceLabel } from "../../shared/lib/serviceBundle";
import { RequestExpiryBadge } from "./RequestExpiryBadge";

/**
 * The artist's bookings still waiting for an answer, with «تایید» / «رد» on each card -- the same
 * board the salon has above its schedule. Shown on the bookings tab and in the notifications sheet.
 */
export function ArtistRequestsBoard({ requests = [], busyId = "", onApprove, onDecline }) {
  if (!requests.length) return null;
  const anyBusy = Boolean(busyId);
  return (
    <section className="salonRequestsBoard" aria-label="نوبت‌های تازه در انتظار پاسخ">
      <div className="boardHead">
        <div>
          <span>نوبت‌های تازه</span>
          <strong>نیاز به تایید شما</strong>
        </div>
        <b>{toPersianDigits(requests.length)} نوبت</b>
      </div>
      <div className="reservationRequestList">
        {requests.map((request) => {
          const busy = String(busyId) === `booking:${request.id}`;
          return (
            <article className="reservationRequestCard" key={request.id}>
              <div className="requestCardMain">
                <div className="requestCardWho">
                  <strong>{request.client || "مشتری"}</strong>
                  <span className="svcInline"><ServiceIcon emoji={request.service_emoji} name={request.service} size="xs" />{shortServiceLabel(request.service)}</span>
                  <small>
                    {request.sourceSalon?.name ? (
                      <><Store size={11} aria-hidden="true" /> از {request.sourceSalon.name}</>
                    ) : "رزرو شخصی"}
                  </small>
                </div>
                <div className="requestCardAside">
                  <SegmentClock value={request.time} size="xs" as="span" />
                  <div className="requestCardWhen">
                    <em>{formatRelativeBookingDayLabel(request.dateKey || request.date)}</em>
                  </div>
                </div>
              </div>
              <RequestExpiryBadge createdAt={request.createdAt} />
              <div className="requestActions">
                <button type="button" className="is-approve" disabled={anyBusy} onClick={() => onApprove?.(request.id)}>
                  <Check size={15} />
                  {busy ? "…" : "تایید"}
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
