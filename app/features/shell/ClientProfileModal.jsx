"use client";

import { MessageCircle } from "lucide-react";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";

const TYPE_LABELS = {
  client: "مشتری",
  artist: "آرتیست",
  salon: "سالن",
  shop: "فروشگاه"
};

/**
 * Booking client profile modal (opened from schedule rows) — also reused
 * as a lightweight reviewer profile when a review's author has no richer
 * public profile view wired up (see HomeApp's onOpenReviewer).
 * Presentational: client payload + message/close callbacks from HomeApp.
 */
export function ClientProfileModal({ client, onClose, onMessage }) {
  if (!client) return null;

  return (
    <div
      className="artistProfileModal clientProfileModal"
      role="dialog"
      aria-modal="true"
      aria-label={`پروفایل ${client.name}`}
      onClick={onClose}
    >
      <article className="clientProfileSheet" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="clientProfileClose" onClick={onClose} aria-label="بستن">
          ×
        </button>
        <div className="clientProfileHero">
          <div className={`clientProfileAvatar ${client.avatar ? "hasImage" : ""}`}>
            {client.avatar ? (
              <img src={client.avatar} alt="" />
            ) : (
              String(client.name || "م").slice(0, 1)
            )}
          </div>
          <div className="clientProfileHeroCopy">
            <span>{client.kicker || "پروفایل مشتری"}</span>
            <b>{client.name}</b>
            <small>
              {client.area || "ایران"}
              {client.type ? ` · ${TYPE_LABELS[client.type] || client.type}` : ""}
            </small>
          </div>
        </div>

        <div className="clientProfileStats">
          <span>
            <b>{toPersianDigits(client.bookingCount || 1)}</b>
            نوبت
          </span>
          <span>
            <b>{client.lastBooking?.service || "—"}</b>
            آخرین خدمت
          </span>
          <span>
            <b>{client.lastBooking?.date || "—"}</b>
            آخرین نوبت
          </span>
        </div>

        <div className="clientProfileInfoGrid">
          <span>
            <b>تماس</b>
            <em dir="ltr">{client.phone || "ثبت نشده"}</em>
          </span>
          <span>
            <b>منطقه</b>
            {client.area || "ثبت نشده"}
          </span>
          <span className="wide">
            <b>درباره</b>
            {client.bio || "توضیحی ثبت نشده"}
          </span>
        </div>

        {client.bookings?.length ? (
          <div className="clientProfileBookings">
            <div className="clientProfileBookingsHead">نوبت‌های این مشتری</div>
            <div className="clientProfileBookingRail">
              {client.bookings.slice(0, 5).map((item) => (
                <article key={item.id}>
                  <b>{item.service || "خدمت"}</b>
                  <span>{item.date} · {item.time}</span>
                  <em>{item.status}</em>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        <div className="clientProfileActions">
          <button type="button" onClick={() => onMessage?.(client)}>
            <MessageCircle size={16} />
            پیام به مشتری
          </button>
          {client.phone ? (
            <a className="clientProfileCall" href={`tel:${toLatinDigits(client.phone)}`}>
              تماس
            </a>
          ) : null}
        </div>
      </article>
    </div>
  );
}
