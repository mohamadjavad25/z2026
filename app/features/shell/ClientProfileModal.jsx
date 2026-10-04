"use client";

import { ServiceIcon } from "../../components/ServiceIcon";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";
import { SheetClose } from "../../components/SheetClose";

const TYPE_LABELS = {
  client: "مشتری",
  artist: "آرتیست",
  salon: "سالن"
};

/**
 * Booking client profile modal (opened from schedule rows).
 * Presentational: client payload + close callback from HomeApp.
 */
export function ClientProfileModal({ client, onClose }) {
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
        <div className="clientProfileHero">
          <div className={`clientProfileAvatar ${client.avatar ? "hasImage" : ""}`}>
            {client.avatar ? (
              <img src={client.avatar} alt="" style={{ objectPosition: client.avatarPosition || client.clientAvatarPosition || "50% 50%" }} />
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
                  <b className="svcInline"><ServiceIcon emoji={item.service_emoji} name={item.service} size="xs" />{item.service || "خدمت"}</b>
                  <span>{item.date} · {item.time}</span>
                  <em>{item.status}</em>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        <div className="clientProfileActions">
          {client.phone ? (
            <a className="clientProfileCall" href={`tel:${toLatinDigits(client.phone)}`}>
              تماس
            </a>
          ) : null}
        </div>
  <SheetClose onClick={onClose} />
      </article>
    </div>
  );
}
