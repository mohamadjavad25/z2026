import { toPersianDigits } from "../../../shared/lib/digits";
import { formatPersianDateKey, formatRelativeBookingDayLabel } from "../../../shared/lib/persianCalendar";
import { ProfileSheet } from "../../profile/ProfileSheet";
import { BellRing, Check, X, TimerOff } from "lucide-react";
import { PageIcon } from "../../../components/PageIcon";
import { ServiceIcon } from "../../../components/ServiceIcon";
import { SegmentClock } from "../../../components/SegmentClock";

import { useHome } from "../HomeContext";
import { shortServiceLabel } from "../../../shared/lib/serviceBundle";
export function SalonNotificationsSheet() {
  const {
    createdProfile,
    salonHeroSheet,
    reservationRequestList,
    pendingSalonCollabRequests,
    salonAppointmentList,
    recentlyExpiredSalonBookings,
    setSalonHeroSheet,
    salonRequestBusyId,
    approveReservationRequest,
    declineReservationRequest
  } = useHome();

  // «نوبت‌های پیش‌رو»: today and later, without cancelled or expired ones (it used to count every booking and was
  // titled «برنامه امروز», so a closed Friday read «۴»; owner's choice 2026-10-23).
  const todayKey = formatPersianDateKey(new Date());
  const ahead = salonAppointmentList.filter((booking) => !["لغو", "منقضی شده"].includes(booking.status) && String(booking.booking_date || "") >= todayKey);
  const todayCount = ahead.filter((booking) => booking.booking_date === todayKey).length;
  const aheadText = !ahead.length
    ? "نوبتی در پیش نیست."
    : todayCount
      ? `امروز ${toPersianDigits(todayCount)} نوبت؛ روی‌هم ${toPersianDigits(ahead.length)} نوبت پیش‌رو.`
      : `امروز نوبتی نداری؛ ${toPersianDigits(ahead.length)} نوبت در روزهای بعد.`;

  return (
    (createdProfile?.type === "salon" && salonHeroSheet === "notifications" && (
          <ProfileSheet
            title="اعلان‌ها"
            label="اعلان‌ها"
            kicker="داشبورد سالن"
            panelClassName="salonNotificationsSheetPanel"
            open
            onClose={() => setSalonHeroSheet(null)}
          >
            <div className="salonNotificationsPanel">
              <article>
                <span><BellRing size={18} /></span>
                <div>
                  <b>اطلاع‌رسانی رزروها</b>
                  <small>{reservationRequestList.length ? `${toPersianDigits(reservationRequestList.length)} درخواست رزرو در انتظار بررسی است.` : "درخواست رزرو تازه‌ای ثبت نشده است."}</small>
                </div>
                <em>{toPersianDigits(reservationRequestList.length)}</em>
              </article>
              <article>
                <span><PageIcon name="collab" size={22} /></span>
                <div>
                  <b>همکاری و پرسنل</b>
                  <small>{pendingSalonCollabRequests.length ? `${toPersianDigits(pendingSalonCollabRequests.length)} درخواست همکاری نیاز به پاسخ دارد.` : "درخواست همکاری تازه‌ای نداری."}</small>
                </div>
                <em>{toPersianDigits(pendingSalonCollabRequests.length)}</em>
              </article>
              <article>
                <span><PageIcon name="bookings" size={22} /></span>
                <div>
                  <b>نوبت‌های پیش‌رو</b>
                  <small>{aheadText}</small>
                </div>
                <em>{toPersianDigits(ahead.length)}</em>
              </article>
            </div>

            {reservationRequestList.length > 0 && (
              <section className="salonRequestsBoard" aria-label="درخواست‌های رزرو در انتظار پاسخ">
                <div className="boardHead">
                  <div>
                    <span>درخواست‌های رزرو</span>
                    <strong>نیاز به تایید شما</strong>
                  </div>
                  <b>{toPersianDigits(reservationRequestList.length)} درخواست</b>
                </div>
                <div className="reservationRequestList">
                  {reservationRequestList.map((request) => {
                    const busy = String(salonRequestBusyId) === `reservation:${request.id}`;
                    const anyBusy = Boolean(salonRequestBusyId);
                    return (
                      <article className="reservationRequestCard" key={request.id}>
                        <div className="requestCardMain">
                          <div className="requestCardWho">
                            <strong>{request.client}</strong>
                            <span className="svcInline"><ServiceIcon emoji={request.service_emoji} name={request.service} size="xs" />{shortServiceLabel(request.service)}</span>
                            <small>
                              <b>{request.staff}</b>
                              <em>مسئول</em>
                            </small>
                          </div>
                          <div className="requestCardAside">
                            <SegmentClock value={request.time} size="xs" as="span" />
                            <div className="requestCardWhen">
                              {/* The day label already names the date («فردا», «یکشنبه ۳ آبان»); the raw key read «1405-08-02». */}
                              <em>{request.day || formatRelativeBookingDayLabel(request.date)}</em>
                            </div>
                          </div>
                        </div>
                        <div className="requestActions">
                          <button
                            type="button"
                            className="is-approve"
                            disabled={anyBusy}
                            onClick={() => approveReservationRequest(request.id)}
                          >
                            <Check size={15} />
                            {busy ? "…" : "تایید"}
                          </button>
                          <button
                            type="button"
                            className="is-decline"
                            disabled={anyBusy}
                            onClick={() => declineReservationRequest(request.id)}
                          >
                            <X size={15} />
                            {busy ? "…" : "رد"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {recentlyExpiredSalonBookings.length > 0 && (
              <section className="salonRequestsBoard salonExpiredNoticeBoard" aria-label="درخواست‌های منقضی‌شده اخیر">
                <div className="boardHead">
                  <div>
                    <span>منقضی‌شده‌های اخیر</span>
                    <strong>در زمانی که مشتری صبر کرد جواب نگرفتند</strong>
                  </div>
                  <b>{toPersianDigits(recentlyExpiredSalonBookings.length)} مورد</b>
                </div>
                <div className="reservationRequestList">
                  {recentlyExpiredSalonBookings.map((booking) => (
                    <article className="reservationRequestCard is-expiredNotice" key={booking.id}>
                      <div className="requestCardMain">
                        <div className="requestCardWho">
                          <strong>{booking.client}</strong>
                          <span className="svcInline"><ServiceIcon emoji={booking.service_emoji} name={booking.service} size="xs" />{shortServiceLabel(booking.service)}</span>
                        </div>
                        <div className="requestCardAside">
                          <span className="expiredNoticeTag">
                            <TimerOff size={14} />
                            منقضی شد
                          </span>
                          <div className="requestCardWhen">
                            <em>{formatRelativeBookingDayLabel(booking.booking_date)}</em>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </ProfileSheet>
        )) || null
  );
}
