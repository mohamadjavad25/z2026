"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, MapPin, Send, Sparkles, Store, Trash2, Users, X } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { buildClockOptions } from "../../shared/lib/time";

function getSalonKey(salon) {
  return String(salon.id || salon.source_key || salon.name);
}

const DAY_PRESETS = [
  { label: "شنبه تا چهارشنبه", value: "شنبه، یکشنبه، دوشنبه، سه‌شنبه، چهارشنبه" },
  { label: "آخر هفته", value: "پنجشنبه، جمعه" },
  { label: "هر روز", value: "شنبه، یکشنبه، دوشنبه، سه‌شنبه، چهارشنبه، پنجشنبه، جمعه" }
];
const NEGOTIABLE = "توافقی";
const SHARE_PRESETS = [
  ...["۳۰", "۴۰", "۵۰", "۶۰"].map((value) => ({ label: `${value}٪`, value })),
  { label: NEGOTIABLE, value: NEGOTIABLE }
];
const CAPACITY_PRESETS = [
  ...["۲", "۴", "۶", "۸"].map((value) => ({ label: value, value })),
  { label: NEGOTIABLE, value: NEGOTIABLE }
];

function PresetRow({ options, isSelected, onPick }) {
  return (
    <div className="collabPresetRow">
      {options.map((option) => (
        <button
          type="button"
          key={option.label}
          className={`collabPresetChip ${isSelected(option.value) ? "is-selected" : ""}`}
          onClick={() => onPick(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Minimal styled dropdown — replaces the native <select>'s OS-rendered popup. */
function TimeSelect({ value, options, onChange, label }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  return (
    <div className={`collabTimeSelect ${open ? "is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="collabTimeSelectTrigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{value}</span>
        <ChevronDown size={14} />
      </button>
      {open ? (
        <div className="collabTimeSelectMenu" role="listbox" aria-label={label}>
          {options.map((slot) => (
            <button
              type="button"
              key={slot}
              role="option"
              aria-selected={slot === value}
              className={`collabTimeSelectOption ${slot === value ? "is-selected" : ""}`}
              onClick={() => {
                onChange(slot);
                setOpen(false);
              }}
            >
              {slot}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
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

function CollabAvatar({ src }) {
  return (
    <span className={`collabAvatar ${src ? "hasImage" : ""}`} aria-hidden="true">
      {src ? <img src={src} alt="" /> : <Store size={16} />}
    </span>
  );
}

function CollabRow({ avatar, title, subtitle, meta, status, actions }) {
  return (
    <article className="collabRow">
      <CollabAvatar src={avatar} />
      <div className="collabRowBody">
        <b>{title}</b>
        {subtitle ? <span>{subtitle}</span> : null}
        {meta ? <small>{meta}</small> : null}
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
        <button type="button" className="collabSalonModalClose" onClick={onClose} aria-label="بستن">
          <X size={18} />
        </button>

        <header className="collabSalonModalHead">
          <CollabAvatar src={salon.avatar} />
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
                      {service.price ? `${toPersianDigits(service.price)} تومان` : "قیمت توافقی"}
                      {service.duration ? ` · ${service.duration}` : ""}
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
            <label className="is-wide">
              <span>روزها</span>
              <input
                value={draft.days}
                onChange={(event) => onDraftChange({ days: event.target.value })}
                placeholder="شنبه، دوشنبه، چهارشنبه"
              />
              <PresetRow
                options={DAY_PRESETS}
                isSelected={(value) => draft.days === value}
                onPick={(value) => onDraftChange({ days: value })}
              />
            </label>
            <div className="collabFormRow">
              <label>
                <span>شروع</span>
                <TimeSelect
                  value={draft.from}
                  options={buildClockOptions(9 * 60, 21 * 60, 60)}
                  onChange={(slot) => onDraftChange({ from: slot })}
                  label="ساعت شروع"
                />
              </label>
              <label>
                <span>پایان</span>
                <TimeSelect
                  value={draft.to}
                  options={buildClockOptions(10 * 60, 22 * 60, 60)}
                  onChange={(slot) => onDraftChange({ to: slot })}
                  label="ساعت پایان"
                />
              </label>
            </div>
            <label>
              <span>سهم آرتیست</span>
              <input
                className="collabHalfInput"
                inputMode="numeric"
                value={draft.share}
                onChange={(event) => onDraftChange({ share: toPersianDigits(event.target.value.replace(/[^\d۰-۹]/g, "")) })}
              />
              <PresetRow
                options={SHARE_PRESETS}
                isSelected={(value) => draft.share === value}
                onPick={(value) => onDraftChange({ share: value })}
              />
            </label>
            <label>
              <span>ظرفیت روزانه</span>
              <input
                className="collabHalfInput"
                inputMode="numeric"
                value={draft.capacity}
                onChange={(event) => onDraftChange({ capacity: toPersianDigits(event.target.value.replace(/[^\d۰-۹]/g, "")) })}
              />
              <PresetRow
                options={CAPACITY_PRESETS}
                isSelected={(value) => draft.capacity === value}
                onPick={(value) => onDraftChange({ capacity: value })}
              />
            </label>
            <button type="submit">
              <Send size={14} />
              ارسال به {salon.name}
            </button>
          </form>
        </section>
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
  inviteRespondBusyId = "",
  draft,
  onDraftChange,
  onSubmit,
  onDelete,
  onInviteRespond
}) {
  const [previewSalon, setPreviewSalon] = useState(null);
  const hiringSalons = salons;
  const selectedSalon = salons.find((item) => String(item.id) === String(draft.salonId)) || hiringSalons[0];
  const pendingInvites = invites.filter((item) => item.status === "در انتظار تایید");
  const handledInvites = invites.filter((item) => item.status !== "در انتظار تایید");

  return (
    <>
    <section className="collabBoard" aria-label="همکاری آرتیست با سالن‌ها">
      {pendingInvites.length > 0 ? (
        <div className="collabSection">
          <small className="collabSectionLabel">دعوت سالن‌ها</small>
          <div className="collabList">
            {pendingInvites.map((invite) => {
              const busy = String(inviteRespondBusyId) === String(invite.id);
              return (
                <CollabRow
                  key={invite.id}
                  avatar={invite.salonAvatar}
                  title={invite.salonName || "سالن زیبابان"}
                  subtitle={invite.role || invite.artistService || "همکار سالن"}
                  meta={invite.salonArea}
                  actions={
                    <div className="collabRowActions">
                      <button
                        type="button"
                        className="is-approve"
                        disabled={busy}
                        onClick={() => onInviteRespond?.(invite.id, "تایید شد")}
                        aria-label="تایید دعوت"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        className="is-decline"
                        disabled={busy}
                        onClick={() => onInviteRespond?.(invite.id, "رد شد")}
                        aria-label="رد دعوت"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  }
                />
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="collabSection">
        <small className="collabSectionLabel">ارسال درخواست همکاری</small>

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
                  <CollabAvatar src={salon.avatar} />
                  {salon.name}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="collabEmpty">
            <Store size={22} />
            <span>فعلا سالنی برای همکاری موجود نیست.</span>
          </div>
        )}
      </div>

      <div className="collabSection">
        <small className="collabSectionLabel">پیشنهادهای من ({toPersianDigits(offers.length)})</small>
        {offers.length ? (
          <div className="collabList">
            {offers.map((offer) => {
              const salonProfile = salons.find((salon) => (
                String(salon.id) === String(offer.salonId) || salon.name === offer.salonName
              ));
              const isPending = offer.status !== "تایید شد" && offer.status !== "پایان یافت";
              const shareLabel = offer.share === NEGOTIABLE ? "سهم توافقی" : `${offer.share}٪ سهم`;
              const capacityLabel = offer.capacity === NEGOTIABLE ? "ظرفیت توافقی" : `${offer.capacity} نفر در روز`;
              return (
                <CollabRow
                  key={offer.id}
                  avatar={offer.salonAvatar || salonProfile?.avatar}
                  title={offer.salonName}
                  subtitle={`${offer.service} · ${shareLabel}`}
                  meta={`${offer.from} تا ${offer.to} · ${capacityLabel}`}
                  status={offer.status}
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
          <div className="collabEmpty">
            <Store size={22} />
            <span>هنوز پیشنهادی نساخته‌ای.</span>
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
                title={invite.salonName || "سالن زیبابان"}
                subtitle={invite.role || "همکار"}
                meta={invite.salonArea}
                status={invite.status}
              />
            ))}
          </div>
        </div>
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
