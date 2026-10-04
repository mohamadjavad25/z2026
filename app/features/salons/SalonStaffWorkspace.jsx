"use client";

import { Check, Send, Settings, X } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { PageIcon } from "../../components/PageIcon";
import { ServiceIcon } from "../../components/ServiceIcon";
import { ServiceIconStrip } from "../../components/ServiceIconStrip";

const DEFAULT_AVATAR = "/profile-icon.svg";

/**
 * Salon owner — staff workspace tab.
 * Presentational: team summary, staff list, pending invites, invite entry point.
 */
export function SalonStaffWorkspace({
  activeStaffCount = 0,
  pendingInvites = [],
  staffList = [],
  onInviteNearby,
  onCancelInvite,
  onOpenStaffPublic,
  onManageStaff
}) {
  const onLeaveCount = Math.max(0, staffList.length - activeStaffCount);
  const stats = [
    { key: "members", label: "عضو تیم", value: staffList.length, tone: "ink" },
    { key: "active", label: "فعال", value: activeStaffCount, tone: "mint" },
    { key: "leave", label: "مرخصی", value: onLeaveCount, tone: "amber" },
    { key: "invites", label: "دعوت‌ها", value: pendingInvites.length, tone: "sky" }
  ];

  return (
    <div className="stfPage">
      <div className="stfHead">
        <span className="stfHeadIcon" aria-hidden="true"><PageIcon name="staff" size={32} /></span>
        <div>
          <span>پرسنل</span>
          <b>آرتیست‌های سالن</b>
        </div>
      </div>

      <div className="stfStats" role="list" aria-label="خلاصه‌ی تیم">
        {stats.map((item) => (
          <div className={`stfStat is-${item.tone}`} role="listitem" key={item.key}>
            <b>{toPersianDigits(item.value)}</b>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <button type="button" className="stfInvite" onClick={onInviteNearby}>
        <span className="stfInviteIcon" aria-hidden="true"><PageIcon name="discover" size={34} /></span>
        <span className="stfInviteCopy">
          <b>دعوت آرتیست</b>
          <small>از بین آرتیست‌های نزدیک، همکار تیمت را پیدا کن</small>
        </span>
        <span className="stfInviteGo" aria-hidden="true"><Send size={16} /></span>
      </button>

      {pendingInvites.length ? (
        <section className="stfSection" aria-label="دعوت‌های در انتظار تایید">
          <div className="stfSectionLabel">
            <span>دعوت‌های در انتظار</span>
            <b>{toPersianDigits(pendingInvites.length)}</b>
          </div>
          {pendingInvites.map((invite) => (
            <article className="stfCard is-pending" key={`invite-${invite.id}`}>
              <img className="stfAvatar" src={invite.artistAvatar || DEFAULT_AVATAR} alt="" aria-hidden="true" draggable={false} />
              <div className="stfMain">
                <b>{invite.artistName}</b>
                <span className="stfRole">
                  <ServiceIcon name={invite.role || invite.artistService} size="xs" />
                  {invite.role || invite.artistService || "آرتیست"}
                  {invite.artistArea ? ` • ${invite.artistArea}` : ""}
                </span>
                <em className="stfState is-pending"><i aria-hidden="true" />در انتظار تایید</em>
              </div>
              <button
                type="button"
                className="stfIconBtn"
                aria-label={`لغو دعوت ${invite.artistName}`}
                title="لغو دعوت"
                onClick={() => onCancelInvite?.(invite.id)}
              >
                <X size={16} />
              </button>
            </article>
          ))}
        </section>
      ) : null}

      {staffList.length ? (
        <section className="stfSection" aria-label="لیست آرتیست‌ها">
          <div className="stfSectionLabel">
            <span>اعضای تیم</span>
            <b>{toPersianDigits(staffList.length)}</b>
          </div>
          {staffList.map((person) => {
            const avatar = person.avatar || person.staff_avatar || "";
            const isActive = person.state !== "مرخصی";
            const role = person.role || person.artist_service || "آرتیست";
            const name = person.artist_name || person.name;
            return (
              <article
                className={`stfCard${isActive ? " is-active" : " is-idle"}`}
                key={person.id || person.name}
                role="button"
                tabIndex={0}
                aria-label={`${name}، ${role}`}
                onClick={() => onOpenStaffPublic?.(person)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpenStaffPublic?.(person);
                  }
                }}
              >
                <span className="stfAvatarWrap">
                  <img className="stfAvatar" src={avatar || DEFAULT_AVATAR} alt="" aria-hidden="true" draggable={false} />
                  <i className={`stfDot ${isActive ? "is-active" : "is-idle"}`} aria-hidden="true" />
                </span>
                <div className="stfMain">
                  <b>{name}</b>
                  <span className="stfRole">
                    <ServiceIcon name={String(role).split(/[،,]/)[0].trim()} size="xs" />
                    {role}
                  </span>
                  <span className="stfMeta">
                    {person.artist_area ? person.artist_area : person.phone ? (
                      <span dir="ltr">{toPersianDigits(person.phone)}</span>
                    ) : null}
                    <em className={`stfState ${isActive ? "is-active" : "is-idle"}`}>
                      {isActive ? <Check size={11} /> : <i aria-hidden="true" />}
                      {person.state || "فعال"}
                    </em>
                  </span>
                </div>
                <button
                  type="button"
                  className="stfIconBtn"
                  aria-label={`مدیریت ${name}`}
                  title="مدیریت پرسنل"
                  onClick={(event) => {
                    event.stopPropagation();
                    onManageStaff?.(person);
                  }}
                >
                  <Settings size={16} />
                </button>
              </article>
            );
          })}
        </section>
      ) : !pendingInvites.length ? (
        <div className="stfEmpty">
          <ServiceIconStrip ids={["haircut", "hair_color", "manicure", "lipstick", "eyebrow"]} size="md" />
          <b>هنوز آرتیستی در تیم نیست</b>
          <p>آرتیست‌ها را از بین آرتیست‌های نزدیک دعوت کن تا رزرو، خدمات و همکاری‌های سالن از همین‌جا مدیریت شوند.</p>
          <button type="button" onClick={onInviteNearby}>
            <Send size={15} />
            دعوت اولین آرتیست
          </button>
        </div>
      ) : null}
    </div>
  );
}
