"use client";

import { Send, Settings, X } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { ProfileEmptyState } from "../profile/ProfileEmptyState";

/**
 * Salon owner — staff workspace tab.
 * Presentational: staff list, pending invites, create/invite entry points.
 */
export function SalonStaffWorkspace({
  activeStaffCount = 0,
  pendingInvites = [],
  staffList = [],
  onCreateStaff,
  onInviteNearby,
  onCancelInvite,
  onOpenStaffPublic,
  onManageStaff
}) {
  return (
    <>
      <div className="toolPanelHead staffWorkspaceHead">
        <div>
          <span>پرسنل</span>
          <b>آرتیست‌های سالن</b>
        </div>
        <div className="staffWorkspaceMeta">
          <span className="staffLiveBadge">
            <i aria-hidden="true" />
            {toPersianDigits(activeStaffCount)} فعال
          </span>
          {pendingInvites.length ? (
            <small>{toPersianDigits(pendingInvites.length)} دعوت در انتظار</small>
          ) : (
            <small>{toPersianDigits(staffList.length)} عضو تیم</small>
          )}
        </div>
      </div>

      <div className="staffActionGrid">
        <button type="button" className="artistInviteCard" onClick={onInviteNearby}>
          <span className="staffActionIcon" aria-hidden="true">
            <Send size={17} />
          </span>
          <span className="staffActionCopy">
            <b>دعوت آرتیست</b>
            <small>از بین آرتیست‌های نزدیک</small>
          </span>
        </button>
      </div>

      {pendingInvites.length ? (
        <div className="artistPendingInviteList" aria-label="دعوت‌های در انتظار تایید">
          <div className="staffSectionLabel">
            <span>دعوت‌های در انتظار</span>
            <b>{toPersianDigits(pendingInvites.length)}</b>
          </div>
          {pendingInvites.map((invite) => (
            <article className="artistRow is-pending-invite" key={`invite-${invite.id}`}>
              <div className={`artistAvatar ${invite.artistAvatar ? "hasImage" : ""}`}>
                {invite.artistAvatar ? <img src={invite.artistAvatar} alt="" /> : String(invite.artistName || "آ").slice(0, 1)}
              </div>
              <div className="artistRowMain">
                <b>{invite.artistName}</b>
                <span>
                  {invite.role || invite.artistService || "آرتیست"}
                  {invite.artistArea ? ` · ${invite.artistArea}` : ""}
                </span>
                <em className="is-pending">
                  <i aria-hidden="true" />
                  در انتظار تایید
                </em>
              </div>
              <button
                type="button"
                className="artistRowManage"
                aria-label={`لغو دعوت ${invite.artistName}`}
                title="لغو دعوت"
                onClick={() => onCancelInvite?.(invite.id)}
              >
                <X size={15} />
              </button>
            </article>
          ))}
        </div>
      ) : null}

      {staffList.length || pendingInvites.length ? (
        <div className="artistList" aria-label="لیست آرتیست‌ها">
          {staffList.length && pendingInvites.length ? (
            <div className="staffSectionLabel">
              <span>اعضای تیم</span>
              <b>{toPersianDigits(staffList.length)}</b>
            </div>
          ) : null}
          {staffList.map((person) => {
            const avatar = person.avatar || person.staff_avatar || "";
            const isActive = person.state !== "مرخصی";
            return (
              <article
                className={`artistRow${isActive ? " is-active-member" : " is-idle-member"}`}
                key={person.id || person.name}
                role="button"
                tabIndex={0}
                onClick={() => onOpenStaffPublic?.(person)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpenStaffPublic?.(person);
                  }
                }}
              >
                <div className={`artistAvatar ${avatar ? "hasImage" : ""}`}>
                  {avatar ? <img src={avatar} alt="" /> : person.name.slice(0, 1)}
                </div>
                <div className="artistRowMain">
                  <b>{person.artist_name || person.name}</b>
                  <span>
                    {person.role || person.artist_service || "آرتیست"}
                    {person.artist_area ? (
                      ` · ${person.artist_area}`
                    ) : person.phone ? (
                      <>
                        {" · "}
                        <span dir="ltr">{toPersianDigits(person.phone)}</span>
                      </>
                    ) : (
                      ""
                    )}
                  </span>
                  <em className={isActive ? "is-active" : "is-idle"}>
                    <i aria-hidden="true" />
                    {person.state || "فعال"}
                  </em>
                </div>
                <button
                  type="button"
                  className="artistRowManage"
                  aria-label={`مدیریت ${person.artist_name || person.name}`}
                  title="مدیریت پرسنل"
                  onClick={(event) => {
                    event.stopPropagation();
                    onManageStaff?.(person);
                  }}
                >
                  <Settings size={15} />
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <ProfileEmptyState
          className="artistEmptyState"
          image="/salon-team-empty.png"
          title="هنوز آرتیستی ثبت نشده"
          description="اولین پروفایل را بساز تا رزرو، خدمات و همکاری‌های سالن از همینجا مدیریت شوند."
          actionLabel="ایجاد اولین آرتیست"
          onAction={onCreateStaff}
        />
      )}
    </>
  );
}
