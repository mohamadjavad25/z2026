"use client";

import { useEffect, useMemo, useState } from "react";
import { PageIcon } from "../../components/PageIcon";
import { ServiceIcon } from "../../components/ServiceIcon";
import { ArrowDownUp, CalendarCheck, Check, CalendarPlus, ContactRound, Link2, MessageSquare, Phone, Repeat2, Search, Sparkles, UserPlus, Users, X } from "lucide-react";
import { ProfileSheet } from "../profile/ProfileSheet";
import { bookingStatusLabel, bookingStatusTone } from "../client/bookingStatus";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";
import { formatRelativeBookingDayLabel, resolveRollingPersianDate } from "../../shared/lib/persianCalendar";
import { buildBookingCustomers, describeFollowTime, pickFreshFollowers, phoneKey } from "./customers";
import { contactPickerNeedsAppUpdate, contactPickerSupported, localPhoneOf, pickContact } from "../../shared/lib/contactPicker";
import { shortServiceLabel } from "../../shared/lib/serviceBundle";
import { buildClientInviteText, buildInviteSmsHref } from "../../shared/lib/inviteSms";
import { InviteClientsSheet } from "../connect/InviteClientsSheet";
import { NO_SHOW_LABEL } from "../../shared/lib/providerRules";

export { buildBookingCustomers };

const FILTERS = [
  { id: "all", label: "همه" },
  { id: "upcoming", label: "نوبت پیش‌رو" },
  { id: "repeat", label: "تکراری" },
  { id: "lapsed", label: "یه مدته نیومده" },
  { id: "nobooking", label: "هنوز نوبت نگرفته" }
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
  { id: "recent", label: "آخرین نوبت" },
  { id: "visits", label: "بیشترین نوبت" },
  { id: "name", label: "اسم" }
];

function Avatar({ customer, size = "" }) {
  return (
    <span className={`cuAvatar ${size} ${customer.avatar ? "hasImage" : ""}`} aria-hidden="true">
      {customer.avatar ? <img src={customer.avatar} alt="" /> : String(customer.name || "م").trim().slice(0, 1)}
    </span>
  );
}

function CustomerSheet({ customer, invite, onBook, onClose }) {
  if (!customer) return null;
  // Not connected yet (a walk-in or a phone booking): one SMS with the page link, so next time they book themselves.
  const inviteHref = !customer.isFollower && customer.phone && invite?.url
    ? buildInviteSmsHref(customer.phone, buildClientInviteText({ placeName: invite.name, url: invite.url }))
    : "";
  return (
    <ProfileSheet open kicker="مشتری" title={customer.name} panelClassName="cuSheet" onClose={onClose}>
      <div className="cuSheetBody">
        <div className="cuSheetTop">
          <Avatar customer={customer} size="is-lg" />
          <div>
            <b>{customer.name}</b>
            <span dir="ltr">{customer.phone ? toPersianDigits(customer.phone) : "شماره نداره"}</span>
          </div>
        </div>
        {customer.isFollower ? (
          <p className={`cuFollowNote${customer.noBookingYet ? " is-waiting" : ""}`}>
            <UserPlus size={15} aria-hidden="true" />
            <span>
              {describeFollowTime(customer.followedAt)} بهت وصل شد.
              {customer.noBookingYet ? " هنوز نوبت نگرفته؛ یه زنگ یا پیامک شاید اولین نوبتش رو بسازه." : ""}
            </span>
          </p>
        ) : null}
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
        {inviteHref ? (
          <a className="cuInviteBtn cuInviteLink" href={inviteHref}>
            <Link2 size={16} aria-hidden="true" /> لینک نوبت رو بفرست
          </a>
        ) : null}
        {onBook ? (
          <button type="button" className="cuBookBtn" onClick={() => onBook(customer)}>
            <CalendarPlus size={16} aria-hidden="true" /> نوبت تازه
          </button>
        ) : null}
        <div className="cuStats">
          <span className="is-came"><b>{toPersianDigits(customer.completed)}</b>اومد</span>
          <span className={customer.noShow ? "is-noshow" : ""}><b>{toPersianDigits(customer.noShow)}</b>نیومد</span>
          <span><b>{toPersianDigits(customer.upcoming)}</b>پیش‌رو</span>
          <span><b>{toPersianDigits(customer.cancelled)}</b>لغو</span>
        </div>
        {customer.bookings.length ? <h4 className="cuHistoryTitle">نوبت‌هاش</h4> : null}
        <ul className="cuHistory">
          {customer.bookings.map((booking, index) => {
            const noShow = Boolean(booking.no_show_at || booking.noShowAt);
            const tone = noShow ? "bad" : bookingStatusTone(booking.status || "تازه");
            const date = booking.booking_date || booking.date || "";
            return (
              <li key={booking.id || index}>
                <ServiceIcon emoji={booking.service_emoji} name={booking.service} size="xs" />
                <div>
                  <b>{shortServiceLabel(booking.service) || "خدمت"}</b>
                  <small>{date ? formatRelativeBookingDayLabel(date) : "—"}{booking.time ? `، ${toPersianDigits(booking.time)}` : ""}</small>
                </div>
                <em className={`is-${tone}`}>{noShow ? NO_SHOW_LABEL : bookingStatusLabel(booking.status)}</em>
              </li>
            );
          })}
        </ul>
      </div>
    </ProfileSheet>
  );
}

/**
 * How often the customer came and didn't: a green box and, once there is a «نیومد», a red one next to it
 * (owner's request 2026-10-25). Nothing while there is no past visit yet.
 */
function CameTally({ came = 0, noShow = 0 }) {
  if (!came && !noShow) return null;
  return (
    <span className="cuTally" aria-label={`${toPersianDigits(came)} بار اومد، ${toPersianDigits(noShow)} بار نیومد`}>
      {came ? <i className="is-came"><Check size={12} aria-hidden="true" />{toPersianDigits(came)} بار اومد</i> : null}
      {noShow ? <i className="is-noshow"><X size={12} aria-hidden="true" />{toPersianDigits(noShow)} بار نیومد</i> : null}
    </span>
  );
}

/**
 * Owner's own customer community page. See buildBookingCustomers for how a
 * "customer" is derived from real bookings.
 *
 * «مخاطبین» (next to the scan button, where the phone has a contact picker, or in an older app that
 * must be updated first, which it says) picks one contact from the phone: someone already a customer opens their card, anyone else opens the new-booking
 * form with their name and number filled in (`onBookCustomer({ client, phone })`).
 *
 * «دعوت مشتری» (`invite`: { url, name, viewerType, onChanged }) opens InviteClientsSheet: the page's QR, a
 * ready message with its link, and scanning a customer's code. A customer who isn't connected yet gets a
 * «فرستادن لینک نوبت‌گیری» SMS on their card.
 */
export function SalonCustomersPage({ active, bookings = [], followers = [], ownerLabel = "سالنت", headerAction = null, invite = null, onBookCustomer }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("recent");
  const [openKey, setOpenKey] = useState("");
  const [canPickContact, setCanPickContact] = useState(false);
  const [contactNotice, setContactNotice] = useState(""); // "update" | "failed"
  useEffect(() => {
    setCanPickContact(Boolean(onBookCustomer) && (contactPickerSupported() || contactPickerNeedsAppUpdate()));
  }, [onBookCustomer]);

  const customers = useMemo(() => buildBookingCustomers(bookings, followers), [bookings, followers]);
  const freshFollowers = useMemo(() => pickFreshFollowers(customers), [customers]);
  const waitingCount = useMemo(() => customers.filter((item) => item.noBookingYet).length, [customers]);
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
      if (filter === "nobooking" && !item.noBookingYet) return false;
      if (!q) return true;
      return item.name.includes(query.trim()) || toLatinDigits(item.phone).includes(q);
    });
    if (sort === "visits") list = [...list].sort((a, b) => b.visitCount - a.visitCount);
    else if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name, "fa"));
    return list;
  }, [customers, query, filter, sort, todayTime]);

  const openCustomer = customers.find((item) => item.key === openKey) || null;

  async function chooseContact() {
    if (contactPickerNeedsAppUpdate()) {
      setContactNotice("update");
      return;
    }
    let contact = null;
    try {
      contact = await pickContact();
    } catch {
      setContactNotice("failed");
      return;
    }
    if (!contact) return;
    const keys = new Set(contact.phones.map(phoneKey).filter((key) => key.length >= 10));
    const known = customers.find((item) => keys.has(phoneKey(item.phone)));
    if (known) {
      setOpenKey(known.key);
      return;
    }
    onBookCustomer?.({ client: contact.name, phone: localPhoneOf(contact.phones) });
  }

  return (
    <div className={`salonCustomersPage mobilePage page-customers ${active ? "is-active" : ""}`} id="customers">
      <div className="salonCustomersHead">
        <div className="salonCustomersTitle">
          <span className="wavyTitle">مشتری‌هام</span>
        </div>
        <div className="cuHeadActions">
          {/* No customers yet: the empty card below has the one invite button. */}
          {invite && customers.length > 0 ? (
            <button type="button" className="cuInviteBtn" onClick={() => setInviteOpen(true)}>
              <UserPlus size={17} aria-hidden="true" />
              دعوت مشتری
            </button>
          ) : null}
          {headerAction}
          {canPickContact ? (
            <button type="button" className="cuContactBtn" onClick={chooseContact} aria-label="از مخاطب‌های گوشی">
              <ContactRound size={17} aria-hidden="true" />
              مخاطب‌ها
            </button>
          ) : null}
        </div>
      </div>

      {freshFollowers.length ? (
        <section className="cuFresh" aria-label="مشتری‌های تازه">
          <header className="cuFreshHead">
            <span className="cuFreshSpark" aria-hidden="true"><Sparkles size={18} /></span>
            <div>
              <b>تازه وصل شدن</b>
              <small>
                {toPersianDigits(freshFollowers.length)} نفر تازه بهت وصل شدن.
              </small>
            </div>
          </header>
          <ul className="cuFreshList">
            {freshFollowers.map((customer) => (
              <li className={`cuFreshItem${customer.isNewFollower ? " is-new" : ""}`} key={customer.key}>
                <button type="button" className="cuFreshMain" onClick={() => setOpenKey(customer.key)} aria-label={`جزئیات ${customer.name}`}>
                  <Avatar customer={customer} />
                  <span className="cuFreshInfo">
                    <b>
                      {customer.name}
                      {customer.isNewFollower ? <em className="cuNewTag">تازه</em> : null}
                    </b>
                    <span dir="ltr">{customer.phone ? toPersianDigits(customer.phone) : "شماره نداره"}</span>
                    <small className="cuFreshMeta">
                      <span>{describeFollowTime(customer.followedAt)}</span>
                      <i className={customer.noBookingYet ? "is-waiting" : "is-booked"}>
                        {customer.noBookingYet ? "هنوز نوبت نگرفته" : "قبلاً نوبت گرفته"}
                      </i>
                    </small>
                  </span>
                </button>
                <span className="cuFreshActions">
                  {customer.phone ? (
                    <a href={`sms:${toLatinDigits(customer.phone)}`} aria-label={`پیامک به ${customer.name}`}><MessageSquare size={16} /></a>
                  ) : null}
                  {customer.phone ? (
                    <a href={`tel:${toLatinDigits(customer.phone)}`} aria-label={`تماس با ${customer.name}`}><Phone size={16} /></a>
                  ) : null}
                  {onBookCustomer ? (
                    <button type="button" onClick={() => onBookCustomer({ client: customer.name, phone: customer.phone })} aria-label={`نوبت تازه برای ${customer.name}`}>
                      <CalendarPlus size={16} />
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          {freshFollowers.some((customer) => customer.noBookingYet) ? (
            <p className="cuFreshHint">
              اونایی که هنوز نوبت نگرفتن، آماده‌ترین مشتری‌هاتن؛ با یه زنگ یا پیامک اولین نوبتشون رو بساز.
            </p>
          ) : null}
        </section>
      ) : null}

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
              placeholder="اسم یا شماره…"
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
                  {item.id === "nobooking" && waitingCount ? <b className="cuChipCount">{toPersianDigits(waitingCount)}</b> : null}
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
            <b>هنوز مشتری‌ای نداری</b>
            <p>مشتری‌هایی که همین الان داری رو دعوت کن: کد صفحه‌ت رو اسکن کنن یا لینکش رو براشون بفرست. هر کی وصل بشه یا نوبت بگیره، اینجا میاد.</p>
            {invite ? (
              <button type="button" className="cuInviteBtn" onClick={() => setInviteOpen(true)}>
                <UserPlus size={17} aria-hidden="true" />
                دعوت مشتری
              </button>
            ) : null}
          </div>
        ) : visibleCustomers.length === 0 ? (
          <div className="emptySalonDirectory">
            <Search size={22} />
            <b>پیدا نشد</b>
            <p>یه فیلتر یا اسم دیگه امتحان کن.</p>
          </div>
        ) : null}
        {visibleCustomers.map((customer) => (
          <article className="salonCustomerRow" key={customer.key}>
            <button type="button" className="cuRowMain" onClick={() => setOpenKey(customer.key)} aria-label={`جزئیات ${customer.name}`}>
              <Avatar customer={customer} />
              <span className="salonCustomerInfo">
                <b>{customer.name}</b>
                <span dir="ltr">{customer.phone ? toPersianDigits(customer.phone) : "شماره نداره"}</span>
                {customer.lastService ? (
                  <em className="salonCustomerService"><ServiceIcon name={customer.lastService} size="xs" />{customer.lastService}</em>
                ) : null}
                {customer.noBookingYet ? (
                  <small>
                    <i className="cuWaitTag">وصل شده، هنوز نوبت نگرفته</i>
                    {`، ${describeFollowTime(customer.followedAt)}`}
                  </small>
                ) : (
                  <small>
                    {toPersianDigits(customer.visitCount)} بار نوبت
                    {customer.upcoming > 0 ? `، ${toPersianDigits(customer.upcoming)} نوبت پیش‌رو` : customer.lastDate ? `، ${formatRelativeBookingDayLabel(customer.lastDate)}` : ""}
                    {customer.isFollower ? "، وصل شده" : ""}
                  </small>
                )}
                <CameTally came={customer.completed} noShow={customer.noShow} />
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
      {contactNotice ? (
        <ProfileSheet open kicker="مخاطبین" title={contactNotice === "update" ? "اپ رو به‌روز کن" : "مخاطب‌ها باز نشد"} onClose={() => setContactNotice("")}>
          <div className="cuSheetBody">
            {contactNotice === "update" ? (
              <>
                <p className="cuNotice">برای انتخاب از مخاطب‌های گوشی، نسخهٔ تازهٔ اپ فرفرو رو نصب کن.</p>
                <a className="cuBookBtn" href="/download">نسخهٔ تازه رو بگیر</a>
              </>
            ) : (
              <p className="cuNotice">مخاطب‌های گوشی باز نشد؛ دوباره بزن.</p>
            )}
          </div>
        </ProfileSheet>
      ) : null}
      {invite ? (
        <InviteClientsSheet
          open={inviteOpen}
          url={invite.url}
          name={invite.name}
          viewerType={invite.viewerType}
          onChanged={invite.onChanged}
          onClose={() => setInviteOpen(false)}
        />
      ) : null}
      <CustomerSheet
        customer={openCustomer}
        invite={invite}
        onBook={onBookCustomer ? (customer) => {
          setOpenKey("");
          onBookCustomer({ client: customer.name, phone: customer.phone });
        } : undefined}
        onClose={() => setOpenKey("")}
      />
    </div>
  );
}
