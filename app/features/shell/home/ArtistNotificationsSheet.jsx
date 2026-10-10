import { toPersianDigits } from "../../../shared/lib/digits";
import { formatRelativeBookingDayLabel } from "../../../shared/lib/persianCalendar";
import { ProfileSheet } from "../../profile/ProfileSheet";
import { BellRing, CalendarClock, Check, X, TimerOff } from "lucide-react";
import { PageIcon } from "../../../components/PageIcon";
import { ServiceIcon } from "../../../components/ServiceIcon";
import { SegmentClock } from "../../../components/SegmentClock";

import { useHome } from "../HomeContext";
import { shortServiceLabel } from "../../../shared/lib/serviceBundle";
export function ArtistNotificationsSheet() {
  const {
    createdProfile,
    profileView,
    pendingArtistBookingRequests,
    pendingArtistSalonInvites,
    artistBookingList,
    recentlyExpiredArtistBookings,
    setProfileView,
    artistRequestBusyId,
    confirmArtistBookingRequest,
    declineArtistBookingRequest
  } = useHome();

  return (
    (createdProfile?.type === "artist" && profileView === "notifications" && (
          <ProfileSheet
            title="اعلان‌ها"
            label="اعلان‌ها"
            kicker="داشبورد آرتیست"
            panelClassName="salonNotificationsSheetPanel"
            open
            onClose={() => setProfileView("overview")}
          >
            <div className="salonNotificationsPanel">
              <article>
                <span><BellRing size={18} /></span>
                <div>
                  <b>نوبت‌های تازه</b>
                  <small>{pendingArtistBookingRequests.length ? `${toPersianDigits(pendingArtistBookingRequests.length)} نوبت تازه هنوز بررسی نشده است.` : "نوبت تازه‌ای ثبت نشده است."}</small>
                </div>
                <em>{toPersianDigits(pendingArtistBookingRequests.length)}</em>
              </article>
              <article>
                <span><PageIcon name="collab" size={22} /></span>
                <div>
                  <b>دعوت همکاری سالن‌ها</b>
                  <small>{pendingArtistSalonInvites.length ? `${toPersianDigits(pendingArtistSalonInvites.length)} دعوت همکاری نیاز به پاسخ دارد.` : "دعوت همکاری تازه‌ای نداری."}</small>
                </div>
                <em>{toPersianDigits(pendingArtistSalonInvites.length)}</em>
              </article>
              <article>
                <span><CalendarClock size={18} /></span>
                <div>
                  <b>برنامه نوبت‌ها</b>
                  <small>{artistBookingList.length ? `${toPersianDigits(artistBookingList.length)} نوبت در برنامه‌ات ثبت شده است.` : "برنامه نوبت‌ها خالی است."}</small>
                </div>
                <em>{toPersianDigits(artistBookingList.length)}</em>
              </article>
            </div>

            {pendingArtistBookingRequests.length > 0 && (
              <section className="salonRequestsBoard" aria-label="نوبت‌های تازه در انتظار پاسخ">
                <div className="boardHead">
                  <div>
                    <span>نوبت‌های تازه</span>
                    <strong>نیاز به تایید شما</strong>
                  </div>
                  <b>{toPersianDigits(pendingArtistBookingRequests.length)} نوبت</b>
                </div>
                <div className="reservationRequestList">
                  {pendingArtistBookingRequests.map((request) => {
                    const busy = String(artistRequestBusyId) === `booking:${request.id}`;
                    const anyBusy = Boolean(artistRequestBusyId);
                    return (
                      <article className="reservationRequestCard" key={request.id}>
                        <div className="requestCardMain">
                          <div className="requestCardWho">
                            <strong>{request.client || "مشتری"}</strong>
                            <span className="svcInline"><ServiceIcon emoji={request.service_emoji} name={request.service} size="xs" />{shortServiceLabel(request.service)}</span>
                            {request.phone ? <small dir="ltr">{request.phone}</small> : null}
                          </div>
                          <div className="requestCardAside">
                            <SegmentClock value={request.time} size="xs" as="span" />
                            <div className="requestCardWhen">
                              <em>{formatRelativeBookingDayLabel(request.dateKey || request.date)}</em>
                            </div>
                          </div>
                        </div>
                        <div className="requestActions">
                          <button
                            type="button"
                            className="is-approve"
                            disabled={anyBusy}
                            onClick={() => confirmArtistBookingRequest(request.id)}
                          >
                            <Check size={15} />
                            {busy ? "…" : "تایید"}
                          </button>
                          <button
                            type="button"
                            className="is-decline"
                            disabled={anyBusy}
                            onClick={() => declineArtistBookingRequest(request.id)}
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

            {recentlyExpiredArtistBookings.length > 0 && (
              <section className="salonRequestsBoard salonExpiredNoticeBoard" aria-label="نوبت‌های منقضی‌شده اخیر">
                <div className="boardHead">
                  <div>
                    <span>منقضی‌شده‌های اخیر</span>
                    <strong>بدون پاسخ در بازه ۱ ساعته باقی ماندند</strong>
                  </div>
                  <b>{toPersianDigits(recentlyExpiredArtistBookings.length)} مورد</b>
                </div>
                <div className="reservationRequestList">
                  {recentlyExpiredArtistBookings.map((request) => (
                    <article className="reservationRequestCard is-expiredNotice" key={request.id}>
                      <div className="requestCardMain">
                        <div className="requestCardWho">
                          <strong>{request.client || "مشتری"}</strong>
                          <span className="svcInline"><ServiceIcon emoji={request.service_emoji} name={request.service} size="xs" />{shortServiceLabel(request.service)}</span>
                        </div>
                        <div className="requestCardAside">
                          <span className="expiredNoticeTag">
                            <TimerOff size={14} />
                            منقضی شد
                          </span>
                          <div className="requestCardWhen">
                            <em>{formatRelativeBookingDayLabel(request.dateKey || request.date)}</em>
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
