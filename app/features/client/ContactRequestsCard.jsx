"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquareText, X } from "lucide-react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { listContactRequests, removeContactRequest } from "../../shared/api/contactRequests";
import { formatRelativeBookingDayLabel } from "../../shared/lib/persianCalendar";
import { toPersianDigits } from "../../shared/lib/digits";
import { CONTACT_REQUESTS_CHANGED } from "../connect/ContactRequestFlow";

const STATUS = {
  waiting: { label: "منتظر جواب", tone: "wait" },
  expired: { label: "بی‌جواب موند", tone: "off" },
  declined: { label: "نتونست", tone: "off" }
};

/**
 * The client's requests to salons and artists not on frfro yet (owner, 2026-11-12), on the home page: each one's
 * place, service, day and hour and where it stands. A waiting one can be taken back; a closed one hidden. Once that
 * place signs up the request becomes a normal booking and leaves this card for «نوبت‌های پیش‌رو».
 */
export function ContactRequestsCard({ clientName = "", onNotify }) {
  const [requests, setRequests] = useState([]);
  const [busyId, setBusyId] = useState(0);

  const load = useCallback(async () => {
    try {
      const { ok, data } = await listContactRequests();
      if (ok) setRequests(data?.requests || []);
    } catch {
      // the card simply stays as it was
    }
  }, []);

  useEffect(() => {
    load();
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    window.addEventListener(CONTACT_REQUESTS_CHANGED, load);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(CONTACT_REQUESTS_CHANGED, load);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  async function remove(request) {
    setBusyId(request.id);
    try {
      const { ok, payload } = await removeContactRequest(request.id);
      if (!ok) onNotify?.(payload?.error || "نشد؛ دوباره بزن.");
      await load();
    } catch {
      onNotify?.("نشد؛ دوباره بزن.");
    } finally {
      setBusyId(0);
    }
  }

  if (!requests.length) return null;
  return (
    <section className="crBoard" aria-label="درخواست‌ها">
      {requests.map((request) => {
        const status = STATUS[request.status] || STATUS.waiting;
        const when = `${formatRelativeBookingDayLabel(request.bookingDate)}، ساعت ${toPersianDigits(request.time)}`;
        const place = request.contactName || `شمارهٔ …${toPersianDigits(request.phoneEnd)}`;
        // frfro could not text it (SMS not set up yet): the client sends the link from their own phone.
        const text = request.link
          ? `سلام${clientName ? `، ${clientName} هستم` : ""}. برای ${request.service}، ${when} ازت نوبت خواستم: ${request.link}`
          : "";
        return (
          <article key={request.id} className={`crItem is-${status.tone}`}>
            <ServiceIcon emoji={request.serviceEmoji} name={request.service} size="sm" />
            <div className="crItemText">
              <b>{place}</b>
              <span>{request.service}</span>
              <small>{when}</small>
              <em className={`crChip is-${status.tone}`}>{status.label}</em>
            </div>
            <div className="crItemActions">
              {request.link ? (
                <a className="crSmallBtn is-live" href={`sms:?&body=${encodeURIComponent(text)}`}>
                  <MessageSquareText size={15} aria-hidden="true" />
                  پیامک
                </a>
              ) : null}
              <button
                type="button"
                className="crSmallBtn"
                disabled={busyId === request.id}
                onClick={() => remove(request)}
                aria-label={request.status === "waiting" ? `لغو درخواست ${request.service}` : "برداشتن"}
              >
                {request.status === "waiting" ? "لغو" : <X size={16} aria-hidden="true" />}
              </button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
