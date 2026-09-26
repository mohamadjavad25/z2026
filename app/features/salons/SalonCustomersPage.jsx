"use client";

import { useMemo, useState } from "react";
import { Phone, Search, Users } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatRelativeBookingDayLabel } from "../../shared/lib/persianCalendar";

function customerKey(booking) {
  return (
    ((booking.client_user_id || booking.clientUserId) && `id:${booking.client_user_id || booking.clientUserId}`)
    || (booking.phone && `phone:${String(booking.phone).replace(/\D/g, "")}`)
    || (booking.client && `name:${booking.client.trim()}`)
    || null
  );
}

/**
 * Owner's own customer community — grouped from their real bookings
 * (salonAppointmentList for a salon, artistBookingList for an artist),
 * not a separate table: a "customer" is anyone who has ever booked with
 * this account. Rows already arrive newest first (listSalonBookings /
 * the artist booking list both order by id DESC), so the first booking
 * seen per grouping key is that customer's most recent visit.
 */
export function SalonCustomersPage({ active, bookings = [], onOpenBooking, ownerLabel = "سالن شما" }) {
  const [query, setQuery] = useState("");

  const customers = useMemo(() => {
    const byKey = new Map();
    bookings.forEach((booking) => {
      const key = customerKey(booking);
      if (!key) return;
      const existing = byKey.get(key);
      if (existing) {
        existing.visitCount += booking.status === "لغو" ? 0 : 1;
        return;
      }
      byKey.set(key, {
        key,
        name: booking.client || "مشتری",
        phone: booking.phone || "",
        avatar: booking.client_avatar || booking.clientAvatar || "",
        lastService: booking.service || "",
        lastDate: booking.booking_date || booking.date || "",
        visitCount: booking.status === "لغو" ? 0 : 1
      });
    });
    return [...byKey.values()];
  }, [bookings]);

  const normalizedQuery = query.trim();
  const visibleCustomers = normalizedQuery
    ? customers.filter((item) =>
        [item.name, item.phone].filter(Boolean).some((field) => field.includes(normalizedQuery))
      )
    : customers;

  return (
    <div className={`salonCustomersPage mobilePage page-customers ${active ? "is-active" : ""}`} id="customers">
      <div className="salonCustomersHead">
        <div>
          <span>جامعه مشتریان</span>
          <strong>{ownerLabel}</strong>
        </div>
        <b>{toPersianDigits(visibleCustomers.length)} مشتری</b>
      </div>
      <label className="salonCustomersSearch">
        <Search size={16} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="جستجوی نام یا شماره..."
          aria-label="جستجوی مشتریان"
        />
      </label>
      <div className="salonCustomersList">
        {customers.length === 0 ? (
          <div className="emptySalonDirectory">
            <Users size={22} />
            <b>هنوز مشتری‌ای ثبت نشده</b>
            <p>با اولین رزرو، اینجا پر می‌شود.</p>
          </div>
        ) : visibleCustomers.length === 0 ? (
          <div className="emptySalonDirectory">
            <Search size={22} />
            <b>نتیجه‌ای پیدا نشد</b>
            <p>عبارت دیگری را امتحان کن.</p>
          </div>
        ) : null}
        {visibleCustomers.map((customer) => (
          <article className="salonCustomerRow" key={customer.key} onClick={() => onOpenBooking?.(customer)}>
            <img className="salonCustomerAvatar" src={customer.avatar || "/profile-icon.svg"} alt="" aria-hidden="true" />
            <div className="salonCustomerInfo">
              <b>{customer.name}</b>
              <span dir="ltr">{customer.phone ? toPersianDigits(customer.phone) : "شماره ثبت نشده"}</span>
              <small>
                {toPersianDigits(customer.visitCount)} بار رزرو
                {customer.lastService ? ` · آخرین خدمت: ${customer.lastService}` : ""}
                {customer.lastDate ? ` · ${formatRelativeBookingDayLabel(customer.lastDate)}` : ""}
              </small>
            </div>
            {customer.phone ? (
              <a
                className="salonCustomerCallBtn"
                href={`tel:${customer.phone}`}
                onClick={(event) => event.stopPropagation()}
                aria-label={`تماس با ${customer.name}`}
              >
                <Phone size={16} />
              </a>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
