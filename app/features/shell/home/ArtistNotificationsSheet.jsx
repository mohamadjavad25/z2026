import { toPersianDigits } from "../../../shared/lib/digits";
import { formatRelativeBookingDayLabel } from "../../../shared/lib/persianCalendar";
import { ProfileSheet } from "../../profile/ProfileSheet";
import { BellRing, CalendarClock, ChevronLeft, TimerOff } from "lucide-react";
import { PageIcon } from "../../../components/PageIcon";
import { ServiceIcon } from "../../../components/ServiceIcon";
import { SegmentClock } from "../../../components/SegmentClock";

import { useHome } from "../HomeContext";
import { ArtistRequestsBoard } from "../../schedule/ArtistRequestsBoard";
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
              {/* Every row is a button (2026-10-31; only «دعوت همکاری» used to react). New bookings: down to the answers, or back to the schedule when empty. */}
              <button
                type="button"
                className={`salonNoticeRow${pendingArtistBookingRequests.length ? " is-live" : ""}`}
                onClick={() => {
                  const board = typeof document !== "undefined" ? document.getElementById("artistRequestsBoard") : null;
                  if (board && pendingArtistBookingRequests.length) board.scrollIntoView({ behavior: "smooth", block: "start" });
                  else setProfileView("overview");
                }}
              >
                <span><BellRing size={18} /></span>
                <div>
                  <b>نوبت‌های تازه</b>
                  <small>{pendingArtistBookingRequests.length ? `${toPersianDigits(pendingArtistBookingRequests.length)} نوبت تازه منتظر جوابته. بزن تا ببینی.` : "فعلاً نوبت تازه‌ای نیست."}</small>
                </div>
                <em>{toPersianDigits(pendingArtistBookingRequests.length)}</em>
                <ChevronLeft size={16} className="salonNoticeGo" aria-hidden="true" />
              </button>
              {/* Opens «همکاری», where invites are answered (2026-10-30; it used to be a note that did nothing). */}
              <button type="button" className={`salonNoticeRow${pendingArtistSalonInvites.length ? " is-live" : ""}`} onClick={() => setProfileView("collabs")}>
                <span><PageIcon name="collab" size={22} /></span>
                <div>
                  <b>دعوت همکاری سالن‌ها</b>
                  <small>{pendingArtistSalonInvites.length ? `${toPersianDigits(pendingArtistSalonInvites.length)} دعوت همکاری منتظر جوابته. بزن تا ببینی.` : "دعوت تازه‌ای نیست."}</small>
                </div>
                <em>{toPersianDigits(pendingArtistSalonInvites.length)}</em>
                <ChevronLeft size={16} className="salonNoticeGo" aria-hidden="true" />
              </button>
              <button type="button" className="salonNoticeRow" onClick={() => setProfileView("overview")}>
                <span><CalendarClock size={18} /></span>
                <div>
                  <b>نوبت‌های پیش‌رو</b>
                  <small>{artistBookingList.length ? `${toPersianDigits(artistBookingList.length)} نوبت توی برنامه‌ته.` : "برنامه‌ت خالیه."}</small>
                </div>
                <em>{toPersianDigits(artistBookingList.length)}</em>
                <ChevronLeft size={16} className="salonNoticeGo" aria-hidden="true" />
              </button>
            </div>

            <div id="artistRequestsBoard">
              <ArtistRequestsBoard
                requests={pendingArtistBookingRequests}
                busyId={artistRequestBusyId}
                onApprove={confirmArtistBookingRequest}
                onDecline={declineArtistBookingRequest}
              />
            </div>

            {recentlyExpiredArtistBookings.length > 0 && (
              <section className="salonRequestsBoard salonExpiredNoticeBoard" aria-label="نوبت‌های منقضی‌شده اخیر">
                <div className="boardHead">
                  <div>
                    <span>بی‌جواب موندن</span>
                    <strong>تا وقتی مشتری صبر کرد جواب نگرفتن</strong>
                  </div>
                  <b>{toPersianDigits(recentlyExpiredArtistBookings.length)} تا</b>
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
