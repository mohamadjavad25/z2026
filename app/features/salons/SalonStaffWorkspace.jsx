"use client";

import { useState } from "react";
import { Link2, Plus, X } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { ServiceIcon } from "../../components/ServiceIcon";
import { ServiceIconStrip } from "../../components/ServiceIconStrip";
import { SalonOwnerTeamCard } from "./SalonOwnerTeamCard";
import { SalonTeamToday } from "../team/SalonTeamToday";
import { WeekStrip } from "../team/WeekStrip";
import { memberToday, weekFromHours } from "../team/teamWeek";

const DEFAULT_AVATAR = "/profile-icon.svg";

const splitRoles = (role) => String(role || "").split(/[،,]/).map((item) => item.trim()).filter(Boolean);

/**
 * Salon owner — «پرسنل» tab (owner's choice of 2026-10-28, docs/DECISIONS.md): a header with the invite button, filters
 * that do something, a «لیست | امروز» switch, and one live card per member (their work, today, this week). A card opens
 * the member's own page (SalonStaffProfileModal). No booking or money numbers here (owner's decision 2026-10-25).
 */
export function SalonStaffWorkspace({
  pendingInvites = [],
  staffList = [],
  salonHours = [],
  onInviteNearby,
  onCancelInvite,
  onManageStaff,
  managerName = "",
  onJoinAsOwner,
  onLeaveAsOwner
}) {
  const [filter, setFilter] = useState("all"); // all | today | leave | waiting
  const [view, setView] = useState("list"); // list | today
  const ownerMember = staffList.find((person) => person.is_owner) || null;
  // The manager's own card sits at the top (with its switch), so the cards below are the rest of the team.
  const teamList = onJoinAsOwner ? staffList.filter((person) => !person.is_owner) : staffList;
  const now = new Date();
  const rows = teamList.map((person) => {
    const week = weekFromHours(person.hours || [], now);
    return { person, week, today: memberToday(person, week) };
  });
  const everyone = staffList.length;
  const inToday = staffList.filter((person) => memberToday(person, weekFromHours(person.hours || [], now)).tone === "ok").length;
  const onLeave = staffList.filter((person) => person.state === "مرخصی").length;
  const shown = rows.filter(({ today }) => (filter === "today" ? today.tone === "ok" : filter === "leave" ? today.tone === "leave" : filter === "waiting" ? false : true));
  const showInvites = filter === "all" || filter === "waiting";
  const summary = !everyone ? "" : inToday ? `${toPersianDigits(everyone)} نفر، ${toPersianDigits(inToday)} نفرشون امروز سرکارن` : `${toPersianDigits(everyone)} نفر`;
  const filters = [
    { key: "all", label: "همه", n: everyone },
    { key: "today", label: "امروز سرکار", n: inToday },
    ...(onLeave ? [{ key: "leave", label: "مرخصی", n: onLeave }] : []),
    ...(pendingInvites.length ? [{ key: "waiting", label: "منتظر جواب", n: pendingInvites.length }] : [])
  ];

  return (
    <div className="stfPage twPage">
      <div className="twHead">
        <div className="twHeadCopy">
          <b>تیم سالن</b>
          {summary ? <small>{summary}</small> : null}
        </div>
        <button type="button" className="twInviteBtn" onClick={onInviteNearby}>
          <Plus size={16} aria-hidden="true" />
          دعوت آرتیست
        </button>
      </div>

      {everyone > 1 ? (
        <div className="twSeg" role="group" aria-label="نمایش تیم">
          <button type="button" className={view === "list" ? "is-on" : ""} aria-pressed={view === "list"} onClick={() => setView("list")}>لیست</button>
          <button type="button" className={view === "today" ? "is-on" : ""} aria-pressed={view === "today"} onClick={() => setView("today")}>امروز</button>
        </div>
      ) : null}

      {view === "list" && (everyone > 1 || pendingInvites.length) ? (
        <div className="twFilters" role="group" aria-label="فیلتر تیم">
          {filters.map((item) => (
            <button type="button" key={item.key} className={filter === item.key ? "is-on" : ""} aria-pressed={filter === item.key} onClick={() => setFilter(item.key)}>
              {item.label}<em>{toPersianDigits(item.n)}</em>
            </button>
          ))}
        </div>
      ) : null}

      {view === "today" ? (
        <SalonTeamToday staffList={staffList} salonHours={salonHours} onOpen={onManageStaff} />
      ) : (
        <>
          {showInvites && pendingInvites.length ? (
            <section className="twInvites" aria-label="دعوت‌هایی که منتظر جوابن">
              {pendingInvites.map((invite) => (
                <article className="twWaiting" key={`invite-${invite.id}`}>
                  <img src={invite.artistAvatar || DEFAULT_AVATAR} alt="" aria-hidden="true" draggable={false} />
                  <div>
                    <b>دعوتت برای {invite.artistName} هنوز جواب نگرفته</b>
                    <small>{invite.role || invite.artistService || "آرتیست"}{invite.artistArea ? `، ${invite.artistArea}` : ""}</small>
                  </div>
                  <button type="button" onClick={() => onCancelInvite?.(invite.id)} aria-label={`لغو دعوت ${invite.artistName}`}>
                    <X size={14} aria-hidden="true" />
                    لغو
                  </button>
                </article>
              ))}
            </section>
          ) : null}

          {onJoinAsOwner && filter === "all" ? (
            <SalonOwnerTeamCard
              managerName={managerName}
              ownerMember={ownerMember}
              onJoin={onJoinAsOwner}
              onLeave={onLeaveAsOwner}
              onManage={onManageStaff}
            />
          ) : null}

          {filter !== "waiting" ? shown.map(({ person, week, today }) => {
            const avatar = person.avatar || person.staff_avatar || "";
            const roles = splitRoles(person.role || person.artist_service);
            const name = person.artist_name || person.name;
            const hasPublic = Boolean(person.has_artist_profile || person.artist_user_id);
            const directOn = person.direct_allowed !== false;
            const pending = Number(person.posts_pending) || 0;
            return (
              <article
                key={person.id || person.name}
                className={`twCard${today.tone === "off" || today.tone === "leave" ? " is-quiet" : ""}`}
                role="button"
                tabIndex={0}
                aria-label={`${name}، ${today.text}`}
                onClick={() => onManageStaff?.(person)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onManageStaff?.(person); }
                }}
              >
                <span className="twAvatar"><img src={avatar || DEFAULT_AVATAR} alt="" aria-hidden="true" draggable={false} /></span>
                <div className="twMain">
                  <b>{name}</b>
                  <span className="twRoles">
                    {roles.length ? roles.map((role) => <span key={role}><ServiceIcon name={role} size="xs" />{role}</span>) : <span>آرتیست</span>}
                  </span>
                </div>
                <div className="twLine">
                  <span className={`twToday is-${today.tone}`}><i aria-hidden="true" />{today.text}</span>
                  {hasPublic && person.hours?.length ? <WeekStrip week={week} /> : null}
                </div>
                <div className="twTags">
                  {person.terms_proposed_by === "artist" ? <span className="twTag is-live">پیشنهاد تازه برای شرایط کار</span> : null}
                  {pending ? <span className="twTag is-live">{toPersianDigits(pending)} نمونه‌کار منتظر تأیید توئه</span> : null}
                  {hasPublic ? <span className="twTag">{directOn ? "نوبت مستقیم باز" : "نوبت مستقیم بسته"}</span> : <span className="twTag is-gray">هنوز صفحهٔ فرفرو نداره</span>}
                </div>
              </article>
            );
          }) : null}

          {filter !== "waiting" && !shown.length && everyone ? (
            <p className="twNone">{filter === "today" ? "امروز هیچ‌کس سرکار نیست." : "الان کسی مرخصی نیست."}</p>
          ) : null}

          {!everyone && !pendingInvites.length ? (
            <div className="stfEmpty">
              <ServiceIconStrip ids={["haircut", "hair_color", "manicure", "lipstick", "eyebrow"]} size="md" />
              <b>تیمت هنوز خالیه</b>
              <p>آرتیستی که باهات کار می‌کنه رو بیار؛ کارها و روزهاش میاد همین‌جا.</p>
              <button type="button" onClick={onInviteNearby}>
                <Plus size={15} aria-hidden="true" />
                دعوت آرتیست
              </button>
            </div>
          ) : filter === "all" ? (
            <div className="twAdd">
              <b>آرتیست دیگه‌ای هم هست؟</b>
              <small>با یه کد یا لینک میاد توی تیمت</small>
              <button type="button" onClick={onInviteNearby}><Link2 size={15} aria-hidden="true" />کد و لینک تیم</button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
