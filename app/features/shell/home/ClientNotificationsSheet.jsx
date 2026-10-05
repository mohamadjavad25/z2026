import { toIsoLikeTimestamp } from "../../../shared/lib/time";
import { Check, X, TimerOff, BellRing } from "lucide-react";
import { ProfileSheet } from "../../profile/ProfileSheet";
import { ServiceIcon } from "../../../components/ServiceIcon";

import { useHome } from "../HomeContext";
export function ClientNotificationsSheet() {
  const {
    createdProfile,
    profileView,
    setProfileView,
    clientBookingList
  } = useHome();

  return (
    (createdProfile?.type === "client" && profileView === "notifications" && (
          <ProfileSheet
            title="اعلان‌ها"
            label="اعلان‌ها"
            kicker="فعالیت من"
            panelClassName="salonNotificationsSheetPanel"
            open
            onClose={() => setProfileView("overview")}
          >
            {(() => {
              const notifiableStatuses = ["تایید شده", "لغو", "منقضی شده"];
              const recentBookingNotices = clientBookingList
                .filter((booking) => notifiableStatuses.includes(booking.status || ""))
                .sort((a, b) => new Date(toIsoLikeTimestamp(b.created_at)) - new Date(toIsoLikeTimestamp(a.created_at)))
                .slice(0, 20);
              return recentBookingNotices.length ? (
                <div className="reservationRequestList" aria-label="آخرین تغییرات رزروها">
                  {recentBookingNotices.map((booking) => {
                    const StatusIcon = booking.status === "تایید شده" ? Check : booking.status === "لغو" ? X : TimerOff;
                    const statusClass = booking.status === "تایید شده" ? "is-approve" : booking.status === "لغو" ? "is-decline" : "is-expiredNotice";
                    return (
                      <article className={`reservationRequestCard ${statusClass}`} key={`${booking.bookingSource || "salon"}-${booking.id}`}>
                        <div className="requestCardMain">
                          <div className="requestCardWho">
                            <strong>{booking.salonName || booking.salon_name || "سالن"}</strong>
                            <span className="svcInline"><ServiceIcon emoji={booking.service_emoji} name={booking.service} size="xs" />{booking.service}</span>
                          </div>
                          <div className="requestCardAside">
                            <span className="expiredNoticeTag">
                              <StatusIcon size={14} />
                              {booking.status}
                            </span>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="salonNotificationsPanel">
                  <article>
                    <span><BellRing size={18} /></span>
                    <div>
                      <b>هنوز اعلانی نداری</b>
                      <small>تغییر وضعیت رزروهایت اینجا نمایش داده می‌شود.</small>
                    </div>
                  </article>
                </div>
              );
            })()}
          </ProfileSheet>
        )) || null
  );
}
