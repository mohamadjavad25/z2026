"use client";

import { useMemo, useState } from "react";
import { PageIcon } from "../../components/PageIcon";
import { ServiceIcon } from "../../components/ServiceIcon";
import { ArrowDownUp, CalendarCheck, MessageSquare, Phone, Repeat2, Search, Users } from "lucide-react";
import { ProfileSheet } from "../profile/ProfileSheet";
import { bookingStatusLabel, bookingStatusTone } from "../client/bookingStatus";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";
import { formatRelativeBookingDayLabel, resolveRollingPersianDate } from "../../shared/lib/persianCalendar";
import { buildBookingCustomers } from "./customers";
import { shortServiceLabel } from "../../shared/lib/serviceBundle";

export { buildBookingCustomers };

const FILTERS = [
  { id: "all", label: "همه" },
  { id: "upcoming", label: "نوبت پیش‌رو" },
  { id: "repeat", label: "تکراری" },
  { id: "lapsed", label: "مدتی نیامده" }
];

const LAPSED_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Had a finished visit, nothing booked ahead, and not seen for a month: worth a friendly nudge. */
function isLapsed(customer, todayTime) {
  return customer.completed > 0
    && customer.upcoming === 0
    && customer.lastVisitTime > 0
    && todayTime - customer.lastVisitTime > LAPSED_DAYS * DAY_MS;
}

const SORTS = [
  { id: "recent", label: "آخرین رزرو" },
  { id: "visits", label: "بیشترین رزرو" },
  { id: "name", label: "نام" }
];

function Avatar({ customer, size = "" }) {
  return (
    <span className={`cuAvatar ${size} ${customer.avatar ? "hasImage" : ""}`} aria-hidden="true">
      {customer.avatar ? <img src={customer.avatar} alt="" /> : String(customer.name || "م").trim().slice(0, 1)}
    </span>
  );
}

function CustomerSheet({ customer, onClose }) {
  if (!customer) return null;
  return (
    <ProfileSheet open kicker="مشتری" title={customer.name} panelClassName="cuSheet" onClose={onClose}>
      <div className="cuSheetBody">
        <div className="cuSheetTop">
          <Avatar customer={customer} size="is-lg" />
          <div>
            <b>{customer.name}</b>
            <span dir="ltr">{customer.phone ? toPersianDigits(customer.phone) : "شماره ثبت نشده"}</span>
          </div>
        </div>
        {customer.phone ? (
          <div className="cuActions">
            <a className="cuCall" href={`tel:${toLatinDigits(customer.phone)}`} aria-label={`تماس با ${customer.name}`}>
              <Phone size={16} /> تماس
            </a>
            <a className="cuCall is-soft" href={`sms:${toLatinDigits(customer.phone)}`} aria-label={`پیامک به ${customer.name}`}>
              <MessageSquare size={16} /> پیامک
            </a>
          </div>
        ) : null}
        <div className="cuStats">
          <span><b>{toPersianDigits(customer.completed)}</b>انجام‌شده</span>
          <span><b>{toPersianDigits(customer.upcoming)}</b>پیش‌رو</span>
          <span><b>{toPersianDigits(customer.cancelled)}</b>لغو</span>
        </div>
        <h4 className="cuHistoryTitle">سابقه رزروها</h4>
        <ul className="cuHistory">
          {customer.bookings.map((booking, index) => {
            const tone = bookingStatusTone(booking.status || "تازه");
            const date = booking.booking_date || booking.date || "";
            return (
              <li key={booking.id || index}>
                <ServiceIcon emoji={booking.service_emoji} name={booking.service} size="xs" />
                <div>
                  <b>{shortServiceLabel(booking.service) || "خدمت"}</b>
                  <small>{date ? formatRelativeBookingDayLabel(date) : "—"}{booking.time ? ` • ${toPersianDigits(booking.time)}` : ""}</small>
                </div>
                <em className={`is-${tone}`}>{bookingStatusLabel(booking.status)}</em>
              </li>
            );
          })}
        </ul>
      </div>
    </ProfileSheet>
  );
}

/**
 * Owner's own customer community page. See buildBookingCustomers for how a
 * "customer" is derived from real bookings.
 */
export function SalonCustomersPage({ active, bookings = [], ownerLabel = "سالن شما", headerAction = null }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("recent");
  const [openKey, setOpenKey] = useState("");

  const customers = useMemo(() => buildBookingCustomers(bookings), [bookings]);
  const repeatCount = useMemo(() => customers.filter((item) => item.visitCount >= 2).length, [customers]);
  const upcomingCount = useMemo(() => customers.filter((item) => item.upcoming > 0).length, [customers]);
  const todayTime = useMemo(() => resolveRollingPersianDate("امروز").getTime(), []);
  const lapsedCount = useMemo(() => customers.filter((item) => isLapsed(item, todayTime)).length, [customers, todayTime]);

  const visibleCustomers = useMemo(() => {
    const q = toLatinDigits(query.trim());
    let list = customers.filter((item) => {
      if (filter === "upcoming" && item.upcoming === 0) return false;
      if (filter === "repeat" && item.visitCount < 2) return false;
      if (filter === "lapsed" && !isLapsed(item, todayTime)) return false;
      if (!q) return true;
      return item.name.includes(query.trim()) || toLatinDigits(item.phone).includes(q);
    });
    if (sort === "visits") list = [...list].sort((a, b) => b.visitCount - a.visitCount);
    else if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name, "fa"));
    return list;
  }, [customers, query, filter, sort, todayTime]);

  const openCustomer = customers.find((item) => item.key === openKey) || null;

  return (
    <div className={`salonCustomersPage mobilePage page-customers ${active ? "is-active" : ""}`} id="customers">
      <div className="salonCustomersHead">
        <div className="salonCustomersTitle">
          <span className="wavyTitle">جامعه مشتریان</span>
        </div>
        {headerAction}
      </div>

      {customers.length ? (
        <>
          <div className="cuTiles" aria-label="خلاصه مشتریان">
            <span><Users size={16} /><b>{toPersianDigits(customers.length)}</b>مشتری</span>
            <span><Repeat2 size={16} /><b>{toPersianDigits(repeatCount)}</b>تکراری</span>
            <span><CalendarCheck size={16} /><b>{toPersianDigits(upcomingCount)}</b>نوبت پیش‌رو</span>
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
          <div className="cuToolbar">
            <div className="cuChips" role="tablist" aria-label="فیلتر مشتریان">
              {FILTERS.map((item) => (
                <button
                  type="button"
                  role="tab"
                  key={item.id}
                  aria-selected={filter === item.id}
                  className={filter === item.id ? "is-on" : ""}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                  {item.id === "lapsed" && lapsedCount ? <b className="cuChipCount">{toPersianDigits(lapsedCount)}</b> : null}
                </button>
              ))}
            </div>
            <label className="cuSort">
              <ArrowDownUp size={14} />
              <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="مرتب‌سازی">
                {SORTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
          </div>
        </>
      ) : null}

      <div className="salonCustomersList">
        {customers.length === 0 ? (
          <div className="emptySalonDirectory is-lively">
            <PageIcon name="customers" size={64} />
            <b>هنوز مشتری‌ای ثبت نشده</b>
            <p>با اولین رزرو، مشتری‌هایت اینجا جمع می‌شوند و می‌توانی با یک ضربه تماس بگیری.</p>
          </div>
        ) : visibleCustomers.length === 0 ? (
          <div className="emptySalonDirectory">
            <Search size={22} />
            <b>نتیجه‌ای پیدا نشد</b>
            <p>فیلتر یا عبارت دیگری را امتحان کن.</p>
          </div>
        ) : null}
        {visibleCustomers.map((customer) => (
          <article className="salonCustomerRow" key={customer.key}>
            <button type="button" className="cuRowMain" onClick={() => setOpenKey(customer.key)} aria-label={`جزئیات ${customer.name}`}>
              <Avatar customer={customer} />
              <span className="salonCustomerInfo">
                <b>{customer.name}</b>
                <span dir="ltr">{customer.phone ? toPersianDigits(customer.phone) : "شماره ثبت نشده"}</span>
                {customer.lastService ? (
                  <em className="salonCustomerService"><ServiceIcon name={customer.lastService} size="xs" />{customer.lastService}</em>
                ) : null}
                <small>
                  {toPersianDigits(customer.visitCount)} بار رزرو
                  {customer.upcoming > 0 ? ` • ${toPersianDigits(customer.upcoming)} نوبت پیش‌رو` : customer.lastDate ? ` • ${formatRelativeBookingDayLabel(customer.lastDate)}` : ""}
                </small>
              </span>
            </button>
            {customer.phone ? (
              <a className="salonCustomerCallBtn" href={`tel:${toLatinDigits(customer.phone)}`} aria-label={`تماس با ${customer.name}`}>
                <Phone size={16} />
              </a>
            ) : null}
          </article>
        ))}
      </div>
      <CustomerSheet customer={openCustomer} onClose={() => setOpenKey("")} />
    </div>
  );
}
