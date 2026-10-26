"use client";

import { useState } from "react";
import { CalendarCheck, ChevronLeft, ImagePlus } from "lucide-react";
import { ProfileSheet } from "../profile/ProfileSheet";
import { ServiceIcon } from "../../components/ServiceIcon";
import { ConnectionAvatar } from "../connect/ConnectionCard";
import { SalonClientGallery } from "./SalonClientGallery";
import { thumbUrl } from "../../shared/lib/mediaUrl";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatTomanNumber, parseTomanAmount } from "../../shared/lib/money";

/** The services this team member does at the salon (the salon's own service list says who does what). */
export function memberServices(member, services) {
  if (member?.staffId == null) return [];
  return (services || []).filter((service) => (service.staff_ids || []).map(String).includes(String(member.staffId)));
}

/** A member's posts as gallery items: their own, or the salon's for the owner (the salon's posts are theirs). */
function memberPosts(member, salonPosts) {
  return member.isOwner ? salonPosts : member.posts || [];
}

function doesText(names) {
  if (!names.length) return "";
  return names.length > 2 ? `${names.slice(0, 2).join("، ")} و ${toPersianDigits(names.length - 2)} کار دیگه` : names.join("، ");
}

/**
 * «تیم سالن» on a salon's public page (owner's decision 2026-10-26): a card per member with what they do here and
 * their three newest posts; tapping one opens a sheet with their services and prices, their posts, «رزرو با …»
 * (when `onBookWith` is given: a client, and the salon takes online bookings) and «صفحهٔ …» (members with a frfro
 * page). `team` is the salon's `team` (repos/salons/team.js), in the salon's order.
 */
export function SalonTeam({ salon, team, services, salonPosts = [], getFallbackStyle, postActions = null, onBookWith = null, onOpenArtist = null }) {
  const [openId, setOpenId] = useState(null);
  const members = (team || []).filter((member) => member?.name);
  if (!members.length) return null;
  const open = members.find((member) => String(member.staffId ?? member.name) === openId) || null;
  const openServices = open ? memberServices(open, services) : [];
  const openPosts = open ? memberPosts(open, salonPosts) : [];
  const ownerOf = (member) => ({
    name: member.name,
    role: member.isOwner ? "سالن" : "آرتیست",
    area: salon?.area || "",
    avatar: member.avatar || ""
  });

  return (
    <section className="spvSection spvTeam" aria-labelledby="spv-team-title">
      <div className="spvHeadRow">
        <h3 className="spvHead" id="spv-team-title">تیم سالن</h3>
        {members.length > 1 ? <small className="stmCount">{toPersianDigits(members.length)} نفر</small> : null}
      </div>
      <div className="stmRail">
        {members.map((member) => {
          const key = String(member.staffId ?? member.name);
          const names = memberServices(member, services).map((service) => service.name);
          const posts = memberPosts(member, salonPosts).filter((post) => post.image).slice(0, 3);
          return (
            <button type="button" key={key} className="stmCard" onClick={() => setOpenId(key)} aria-label={`${member.name}، کارهاش و نمونه‌کارهاش`}>
              <span className="stmWho">
                <ConnectionAvatar profile={{ name: member.name, avatar: member.avatar, type: "artist" }} size={36} />
                <span className="stmName">
                  <b>{member.name}</b>
                  <small>{doesText(names) || member.role || "آرتیست"}</small>
                </span>
              </span>
              {posts.length ? (
                <span className="stmThumbs" aria-hidden="true">
                  {posts.map((post) => <img key={post.id} src={thumbUrl(post.image, 160)} alt="" loading="lazy" decoding="async" />)}
                  {Array.from({ length: 3 - posts.length }, (_, index) => <i key={`gap${index}`} />)}
                </span>
              ) : (
                <span className="stmNoPosts">هنوز نمونه‌کاری نذاشته</span>
              )}
            </button>
          );
        })}
      </div>

      <ProfileSheet
        open={Boolean(open)}
        kicker={salon?.name || "سالن"}
        title={open?.name || ""}
        panelClassName="stmSheet"
        onClose={() => setOpenId(null)}
      >
        {open ? (
          <div className="stmSheetBody">
            <div className="stmSheetHead">
              <ConnectionAvatar profile={{ name: open.name, avatar: open.avatar, type: "artist" }} size={56} />
              <span>
                <b>{open.name}</b>
                <small>{open.isOwner ? `صاحب ${salon?.name || "سالن"}` : `توی ${salon?.name || "سالن"}`}</small>
              </span>
            </div>

            {openServices.length ? (
              <div className="stmServices" aria-label={`کارهای ${open.name}`}>
                {openServices.map((service) => {
                  const amount = parseTomanAmount(service.price);
                  return (
                    <div className="stmService" key={service.id ?? service.name}>
                      <ServiceIcon emoji={service.emoji} name={service.name} size="sm" />
                      <span><b>{service.name}</b><small>{service.duration || "مدتش فرق می‌کنه"}</small></span>
                      <em>{amount ? <>{formatTomanNumber(amount)} <small>تومان</small></> : <small>قیمت توافقی</small>}</em>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="stmEmpty">هنوز کاری توی این سالن براش ثبت نشده.</p>
            )}

            {openPosts.length ? (
              <div className="stmPosts">
                <h4>نمونه‌کارها</h4>
                <SalonClientGallery
                  salon={salon}
                  items={openPosts.slice(0, 9)}
                  allItems={openPosts}
                  getFallbackStyle={getFallbackStyle}
                  postActions={postActions}
                  owner={open.isOwner ? null : ownerOf(open)}
                />
              </div>
            ) : (
              <p className="stmEmpty"><ImagePlus size={16} aria-hidden="true" /> هنوز نمونه‌کاری نذاشته</p>
            )}

            <div className="stmActions">
              {onBookWith && openServices.length ? (
                <button type="button" className="stmBook" onClick={() => { setOpenId(null); onBookWith(open, openServices); }}>
                  <CalendarCheck size={18} aria-hidden="true" />
                  رزرو با {open.name}
                </button>
              ) : null}
              {open.artistId ? (
                onOpenArtist ? (
                  <button type="button" className="stmPage" onClick={() => { setOpenId(null); onOpenArtist(open); }}>
                    صفحهٔ {open.name}
                    <ChevronLeft size={16} aria-hidden="true" />
                  </button>
                ) : (
                  <a className="stmPage" href={`/artists/${open.artistId}`}>
                    صفحهٔ {open.name}
                    <ChevronLeft size={16} aria-hidden="true" />
                  </a>
                )
              ) : null}
            </div>
          </div>
        ) : null}
      </ProfileSheet>
    </section>
  );
}
