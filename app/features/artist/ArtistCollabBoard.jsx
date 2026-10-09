"use client";

import { useState } from "react";
import { PageIcon } from "../../components/PageIcon";
import { CollabIllustration } from "../../components/CollabIllustration";
import { createPortal } from "react-dom";
import { Check, LogOut, MapPin, Send, Sparkles, Store, Trash2, Users, X } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatTomanNumber, parseTomanAmount } from "../../shared/lib/money";
import { TermsChips, TermsEditor } from "../collab/TermsEditor";
import { SheetClose } from "../../components/SheetClose";

function getSalonKey(salon) {
  return String(salon.id || salon.source_key || salon.name);
}

/** A salon with no bio and no services has nothing for an artist to
 *  evaluate before proposing terms -- keep it out of the picker until the
 *  salon has actually filled its profile in. */
function hasCollabInfo(salon) {
  return Boolean(salon.bio) && Array.isArray(salon.services) && salon.services.length > 0;
}

const STATUS_LABEL = {
  "تایید شد": "فعال",
  "در انتظار تایید": "در انتظار",
  "رد شد": "رد شد",
  "لغو شد": "لغو شد",
  "پایان یافت": "پایان‌یافته"
};

function statusTone(status) {
  if (status === "تایید شد") return "is-active";
  if (status === "رد شد" || status === "لغو شد" || status === "پایان یافت") return "is-ended";
  return "is-pending";
}

function CollabAvatar({ src, position = "50% 50%" }) {
  return (
    <span className={`collabAvatar ${src ? "hasImage" : ""}`} aria-hidden="true">
      {src ? <img src={src} alt="" style={{ objectPosition: position }} /> : <Store size={16} />}
    </span>
  );
}

function CollabRow({ avatar, title, subtitle, meta, terms, status, actions }) {
  return (
    <article className="collabRow">
      <CollabAvatar src={avatar} />
      <div className="collabRowBody">
        <b>{title}</b>
        {subtitle ? <span>{subtitle}</span> : null}
        {meta ? <small>{meta}</small> : null}
        {terms || null}
      </div>
      {status ? <em className={`collabStatus ${statusTone(status)}`}>{STATUS_LABEL[status] || status}</em> : null}
      {actions || null}
    </article>
  );
}

/** Full salon profile + collaboration-terms form, opened from a salon chip. */
function SalonPreviewModal({ salon, draft, onDraftChange, onSubmit, onClose }) {
  if (!salon) return null;
  const staff = Array.isArray(salon.staff) ? salon.staff : [];
  const services = Array.isArray(salon.services) ? salon.services : [];

  return createPortal(
    <div
      className="collabSalonModal"
      role="dialog"
      aria-modal="true"
      aria-label={`پروفایل ${salon.name}`}
      onClick={onClose}
    >
      <article className="collabSalonModalSheet" onClick={(event) => event.stopPropagation()}>

        <header className="collabSalonModalHead">
          <CollabAvatar src={salon.avatar} position={salon.avatarPosition} />
          <div>
            <b>{salon.name}</b>
            {salon.area ? <span><MapPin size={12} />{salon.area}</span> : null}
          </div>
        </header>

        <section className="collabSection">
          <small className="collabSectionLabel">درباره سالن</small>
          {salon.bio ? (
            <p className="collabSalonModalBio">{salon.bio}</p>
          ) : (
            <div className="collabEmpty">
              <Store size={20} />
              <span>توضیحی برای این سالن ثبت نشده.</span>
            </div>
          )}
        </section>

        <section className="collabSection">
          <small className="collabSectionLabel">اعضای سالن ({toPersianDigits(staff.length)})</small>
          {staff.length ? (
            <div className="collabList">
              {staff.map((member) => (
                <CollabRow
                  key={member.id}
                  avatar={member.avatar}
                  title={member.artist_name || member.name}
                  subtitle={member.role || "همکار"}
                />
              ))}
            </div>
          ) : (
            <div className="collabEmpty">
              <Users size={20} />
              <span>عضوی برای این سالن ثبت نشده.</span>
            </div>
          )}
        </section>

        <section className="collabSection">
          <small className="collabSectionLabel">خدمات و شرایط سالن ({toPersianDigits(services.length)})</small>
          {services.length ? (
            <div className="collabList">
              {services.map((service) => (
                <article className="collabRow" key={service.id}>
                  <span className="collabAvatar" aria-hidden="true"><Sparkles size={16} /></span>
                  <div className="collabRowBody">
                    <b>{service.name}</b>
                    <span>
                      {service.price ? `${formatTomanNumber(parseTomanAmount(service.price))} تومان` : "قیمت توافقی"}
                      {service.duration ? ` • ${service.duration}` : ""}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="collabEmpty">
              <Sparkles size={20} />
              <span>خدمتی برای این سالن ثبت نشده.</span>
            </div>
          )}
        </section>

        <section className="collabSection">
          <small className="collabSectionLabel">تنظیم شرایط و ارسال درخواست</small>
          <form
            className="collabForm"
            onSubmit={(event) => {
              onSubmit(event);
              onClose();
            }}
          >
            <TermsEditor value={draft} onChange={onDraftChange} />
            <button type="submit">
              <Send size={14} />
              ارسال به {salon.name}
            </button>
          </form>
        </section>
  <SheetClose onClick={onClose} />
      </article>
    </div>,
    document.body
  );
}

/**
 * Artist owner — collaboration with salons. Minimal by design: one flat
 * list style reused for invites, hiring salons and offers, no decorative
 * hero/banner chrome.
 */
export function ArtistCollabBoard({
  salons,
  offers,
  invites = [],
  teams = [],
  teamBusyId = "",
  inviteRespondBusyId = "",
  draft,
  onDraftChange,
  onSubmit,
  onDelete,
  onInviteRespond,
  onLeaveTeam
}) {
  const [previewSalon, setPreviewSalon] = useState(null);
  const pendingInvites = invites.filter((item) => item.status === "در انتظار تایید");
  const handledInvites = invites.filter((item) => item.status !== "در انتظار تایید");
  const [tab, setTab] = useState(() => (pendingInvites.length ? "invites" : teams.length ? "teams" : "propose"));
  const hiringSalons = salons.filter(hasCollabInfo);
  const selectedSalon = salons.find((item) => String(item.id) === String(draft.salonId)) || hiringSalons[0];
  const tabs = [
    { key: "invites", label: "دعوت‌ها", count: pendingInvites.length, hot: pendingInvites.length > 0 },
    { key: "teams", label: "تیم‌های من", count: teams.length },
    { key: "propose", label: "پیشنهاد من", count: offers.length }
  ];

  return (
    <>
    <section className="collabBoard" aria-label="همکاری آرتیست با سالن‌ها">
      <div className="clHub" role="tablist" aria-label="بخش‌های همکاری">
        {tabs.map((item) => (
          <button
            type="button"
            role="tab"
            key={item.key}
            aria-selected={tab === item.key}
            className={`clHubTab ${tab === item.key ? "is-active" : ""} ${item.hot ? "is-hot" : ""}`}
            onClick={() => setTab(item.key)}
          >
            {item.label}
            {item.count ? <b>{toPersianDigits(item.count)}</b> : null}
          </button>
        ))}
      </div>

      {tab === "invites" ? (
        <>
          <div className="collabSection">
            <small className="collabSectionLabel">دعوت سالن‌ها</small>
            {pendingInvites.length ? (
              <div className="collabList">
                {pendingInvites.map((invite) => {
                  const busy = String(inviteRespondBusyId) === String(invite.id);
                  return (
                    <CollabRow
                      key={invite.id}
                      avatar={invite.salonAvatar}
                      title={invite.salonName || "سالن frfro"}
                      subtitle={invite.role || invite.artistService || "همکار سالن"}
                      meta={invite.salonArea}
                      terms={<TermsChips days={invite.days} from={invite.from} to={invite.to} share={invite.share} capacity={invite.capacity} />}
                      actions={
                        <div className="collabRowActions">
                          <button type="button" className="is-approve" disabled={busy} onClick={() => onInviteRespond?.(invite.id, "تایید شد")} aria-label="تایید دعوت">
                            <Check size={14} />
                          </button>
                          <button type="button" className="is-decline" disabled={busy} onClick={() => onInviteRespond?.(invite.id, "رد شد")} aria-label="رد دعوت">
                            <X size={14} />
                          </button>
                        </div>
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <div className="collabEmpty is-lively">
                <PageIcon name="collab" size={44} />
                <b>دعوت تازه‌ای نداری</b>
                <span>سالن‌ها می‌توانند تو را به تیمشان دعوت کنند؛ یا خودت از تب «پیشنهاد من» شروع کن.</span>
              </div>
            )}
          </div>
          {handledInvites.length > 0 ? (
            <div className="collabSection">
              <small className="collabSectionLabel">دعوت‌های پاسخ‌داده‌شده ({toPersianDigits(handledInvites.length)})</small>
              <div className="collabList">
                {handledInvites.map((invite) => (
                  <CollabRow
                    key={`handled-invite-${invite.id}`}
                    avatar={invite.salonAvatar}
                    title={invite.salonName || "سالن frfro"}
                    subtitle={invite.role || "همکار"}
                    meta={invite.salonArea}
                    status={invite.status}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {tab === "teams" ? (
        <div className="collabSection">
          <small className="collabSectionLabel">سالن‌هایی که عضو آن‌ها هستی ({toPersianDigits(teams.length)})</small>
          {teams.length ? (
            <div className="collabList">
              {teams.map((team) => (
                <CollabRow
                  key={team.staffId}
                  avatar={team.salonAvatar}
                  title={team.salonName}
                  subtitle={team.role || "همکار سالن"}
                  meta={team.salonArea}
                  terms={<TermsChips days={team.days} from={team.from} to={team.to} share={team.share} capacity={team.capacity} />}
                  actions={
                    <button
                      type="button"
                      className="clLeaveBtn"
                      disabled={String(teamBusyId) === String(team.salonId)}
                      onClick={() => onLeaveTeam?.(team.salonId)}
                    >
                      <LogOut size={13} />
                      ترک تیم
                    </button>
                  }
                />
              ))}
            </div>
          ) : (
            <div className="collabEmpty is-lively">
              <PageIcon name="collab" size={44} />
              <b>هنوز عضو تیمی نیستی</b>
              <span>دعوت یک سالن را بپذیر، QR سالن را اسکن کن یا برای سالن پیشنهاد همکاری بفرست.</span>
            </div>
          )}
        </div>
      ) : null}

      {tab === "propose" ? (
        <>
          <div className="collabHero">
            <CollabIllustration />
            <h3>با سالن‌ها همکار شو</h3>
            <p>پیشنهادت را بفرست؛ اگر سالن قبول کند، عضو تیمش می‌شوی و رزروها را با هم مدیریت می‌کنید.</p>
            <ol className="collabSteps">
              <li><b>۱</b><span>سالن را انتخاب کن</span></li>
              <li><b>۲</b><span>روزها، ساعت و سهمت را مشخص کن</span></li>
              <li><b>۳</b><span>منتظر پاسخ سالن بمان</span></li>
            </ol>
          </div>

          <div className="collabSection">
            <small className="collabSectionLabel">سالن‌هایی که همکار می‌پذیرند</small>
            {hiringSalons.length ? (
              <div className="collabSalonPicker" role="listbox" aria-label="انتخاب سالن">
                {hiringSalons.map((salon) => {
                  const active = selectedSalon && getSalonKey(selectedSalon) === getSalonKey(salon);
                  return (
                    <button
                      type="button"
                      key={getSalonKey(salon)}
                      className={`collabSalonChip ${active ? "is-selected" : ""}`}
                      onClick={() => {
                        onDraftChange({ salonId: salon.id || salon.source_key || salon.name });
                        setPreviewSalon(salon);
                      }}
                    >
                      <CollabAvatar src={salon.avatar} position={salon.avatarPosition} />
                      {salon.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="collabEmpty is-lively">
                <PageIcon name="discover" size={44} />
                <b>هنوز سالنی آماده‌ی همکاری نیست</b>
                <span>سالن‌ها بعد از تکمیل معرفی و خدماتشان اینجا پیدا می‌شوند؛ کمی بعد دوباره سر بزن.</span>
              </div>
            )}
          </div>

          <div className="collabSection">
            <small className="collabSectionLabel">پیشنهادهای ارسالی ({toPersianDigits(offers.length)})</small>
            {offers.length ? (
              <div className="collabList">
                {offers.map((offer) => {
                  const salonProfile = salons.find((salon) => (
                    String(salon.id) === String(offer.salonId) || salon.name === offer.salonName
                  ));
                  const isPending = offer.status !== "تایید شد" && offer.status !== "پایان یافت" && offer.status !== "رد شد";
                  return (
                    <CollabRow
                      key={offer.id}
                      avatar={offer.salonAvatar || salonProfile?.avatar}
                      title={offer.salonName}
                      subtitle={offer.service}
                      terms={<TermsChips days={offer.days} from={offer.from} to={offer.to} share={offer.share} capacity={offer.capacity} />}
                      status={offer.status === "آماده ارسال" ? "در انتظار تایید" : offer.status}
                      actions={isPending ? (
                        <button type="button" className="collabDeleteBtn" aria-label="حذف پیشنهاد" onClick={() => onDelete(offer.id)}>
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="collabEmpty is-lively">
                <PageIcon name="collab" size={44} />
                <b>هنوز پیشنهادی نفرستاده‌ای</b>
                <span>یک سالن را از بالا انتخاب کن و اولین پیشنهاد همکاری‌ات را بساز.</span>
              </div>
            )}
          </div>
        </>
      ) : null}
    </section>
    <SalonPreviewModal
      salon={previewSalon}
      draft={draft}
      onDraftChange={onDraftChange}
      onSubmit={onSubmit}
      onClose={() => setPreviewSalon(null)}
    />
    </>
  );
}
