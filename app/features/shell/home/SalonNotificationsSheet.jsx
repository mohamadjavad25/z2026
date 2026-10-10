import { toPersianDigits } from "../../../shared/lib/digits";
import { formatRelativeBookingDayLabel } from "../../../shared/lib/persianCalendar";
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
                  <b>برنامه امروز</b>
                  <small>{salonAppointmentList.length ? `${toPersianDigits(salonAppointmentList.length)} نوبت در برنامه سالن ثبت شده است.` : "برنامه امروز خالی است."}</small>
                </div>
                <em>{toPersianDigits(salonAppointmentList.length)}</em>
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
                              <em>{request.day}</em>
                              <span>{request.date}</span>
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
                    <strong>بدون پاسخ در بازه ۱ ساعته باقی ماندند</strong>
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
