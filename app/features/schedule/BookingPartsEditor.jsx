"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBackHandler } from "../../shared/hooks/useBackHandler";
import { Check, ChevronDown, ChevronUp, UserRound } from "lucide-react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { toPersianDigits } from "../../shared/lib/digits";
import { scheduleBookingParts } from "../../shared/lib/bookingParts";

const DEFAULT_AVATAR = "/profile-icon.svg";

function staffLabel(person) {
  return person?.artist_name || person?.name || "";
}

/**
 * The team as choices for one service of a booking. `availability` (from
 * GET /api/salon-bookings/:id/staff, by name) marks who is free at that service's time, who does
 * that service, and who is away; free people who do it come first, people with another
 * appointment then cannot be picked (the server would refuse them anyway). Without availability
 * (still loading, or it failed) everyone is listed as before and the server has the last word.
 */
export function ArtistOptionList({ staffOptions = [], current = "", availability = null, label, disabled = false, onPick, onClear, clearLabel }) {
  const infoOf = (person) => availability?.get(String(person.name || "").trim()) || null;
  const rank = (person) => {
    const info = infoOf(person);
    if (!info) return 1;
    if (!info.free) return 4;
    if (info.away) return 3;
    return info.skilled ? 0 : 2;
  };
  const people = [...staffOptions].sort((a, b) => rank(a) - rank(b));
  // Who does this service comes first; the rest of the team waits behind «بقیهٔ تیم» (owner's review, 2026-11-08),
  // unless nobody does it, the picked one is among them, or we do not know yet.
  const [showRest, setShowRest] = useState(false);
  const skilled = people.filter((person) => infoOf(person)?.skilled);
  const restHasCurrent = people.some((person) => person.name === current && !infoOf(person)?.skilled);
  const fold = Boolean(availability) && skilled.length > 0 && !restHasCurrent && !showRest;
  const shown = fold ? skilled : people;
  const hidden = people.length - shown.length;

  return (
    <div className="bpeList" role="listbox" aria-label={label}>
      {shown.map((option) => {
        const active = option.name === current;
        const info = infoOf(option);
        const busy = Boolean(info && !info.free) && !active;
        return (
          <button
            type="button"
            role="option"
            aria-selected={active}
            key={option.id || option.name}
            className={`${active ? "is-selected" : ""}${busy ? " is-busy" : ""}`}
            disabled={disabled || busy}
            onClick={() => onPick?.(option.name, active)}
          >
            <span className="scheduleStaffAvatar hasImage" aria-hidden="true">
              <img src={option.avatar || option.staff_avatar || DEFAULT_AVATAR} alt="" />
            </span>
            <span className="bpeOption">
              <b>{staffLabel(option)}</b>
              <small>{option.role || option.artist_service || "آرتیست"}</small>
            </span>
            {info && !active ? (
              <span className="bpeTags">
                {info.away ? <i className="is-away">{info.away}</i> : null}
                {info.free ? <i className="is-free">آزاد</i> : <i className="is-busy">اون ساعت نوبت داره</i>}
              </span>
            ) : null}
            {active ? <Check size={16} /> : null}
          </button>
        );
      })}
      {fold && hidden > 0 ? (
        <button type="button" className="bpeRest" onClick={() => setShowRest(true)}>
          <span className="bpeOption"><b>بقیهٔ تیم</b><small>{toPersianDigits(hidden)} نفر که این کار رو نمی‌کنن</small></span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      ) : null}
      {onClear ? (
        <button type="button" role="option" aria-selected={false} disabled={disabled} onClick={onClear}>
          <span className="scheduleStaffAvatar" aria-hidden="true"><UserRound size={15} /></span>
          <span className="bpeOption"><b>بدون آرتیست</b><small>{clearLabel || "سالن خودش انجام می‌ده"}</small></span>
        </button>
      ) : null}
    </div>
  );
}

/**
 * The artist list as a half-height sheet over the booking screen (owner's review, 2026-11-08): the
 * screen underneath stays as it was. Closes on the backdrop and the phone's back button; picking
 * someone closes it too (the caller does that).
 */
export function ArtistPickSheet({ open, title, subtitle, onClose, children }) {
  const panelRef = useRef(null);
  useBackHandler(open, () => onClose?.());
  useEffect(() => {
    if (open) panelRef.current?.focus({ preventScroll: true });
  }, [open]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="bpeSheet" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="bpeSheetPanel" ref={panelRef} tabIndex={-1} onClick={(event) => event.stopPropagation()}>
        <span className="bpeSheetGrip" aria-hidden="true" />
        <div className="bpeSheetHead">
          <b>{title}</b>
          {subtitle ? <small>{subtitle}</small> : null}
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

/**
 * «تقسیم بین آرتیست‌ها» in the booking screen of a multi-service booking: one row per service with
 * its clock range (back to back from the booking's start, in this order), its artist, and arrows
 * to reorder. Every change is sent straight away as the whole new list (`onChange(parts)`); the
 * server checks each artist is free and refuses the change otherwise. `availability[index]` is
 * the team's free/busy map for that row (ArtistOptionList).
 */
export function BookingPartsEditor({ booking, staffOptions = [], availability = [], disabled = false, onChange }) {
  const [openIndex, setOpenIndex] = useState(-1);
  const parts = scheduleBookingParts(booking.time, booking.parts);
  if (!parts.length) return null;

  const send = (next) => {
    setOpenIndex(-1);
    onChange?.(next.map(({ service, minutes, staff }) => ({ service, minutes, staff })));
  };
  const move = (index, step) => {
    const next = [...parts];
    [next[index], next[index + step]] = [next[index + step], next[index]];
    send(next);
  };
  const assign = (index, staff) => send(parts.map((part, i) => (i === index ? { ...part, staff } : part)));
  const giveAllTo = (staff) => send(parts.map((part) => ({ ...part, staff })));
  const firstStaff = parts.find((part) => part.staff)?.staff || "";
  const allSame = parts.every((part) => part.staff === firstStaff);
  // «همه با …» only when that artist does every service and is free for each (owner's review, 2026-11-08).
  const canGiveAll = firstStaff && !allSame && parts.every((part, index) => {
    if (part.staff === firstStaff) return true;
    const info = availability[index]?.get(firstStaff);
    return Boolean(info && info.free && info.skilled);
  });
  const total = parts.reduce((sum, part) => sum + (Number(part.minutes) || 0), 0) || parts.length;

  return (
    <div className="bpeBox">
      <div className="bpeHead">
        <b>تقسیم بین آرتیست‌ها</b>
        {!disabled && canGiveAll ? (
          <button type="button" className="bpeAll" onClick={() => giveAllTo(firstStaff)}>همه با {firstStaff}</button>
        ) : null}
      </div>
      <div className="bpeLine" aria-hidden="true">
        {parts.map((part, index) => (
          <span
            key={`${part.service}-${index}`}
            className={`bpeSeg ${index % 2 ? "is-pink" : "is-violet"}${part.staff ? "" : " is-empty"}`}
            style={{ flexGrow: (Number(part.minutes) || 1) / total }}
          >
            <b>{part.staff ? part.staff.split(" ")[0] : "؟"}</b>
            <small>{part.service}</small>
          </span>
        ))}
      </div>
      {parts.map((part, index) => {
        const person = staffOptions.find((item) => item.name === part.staff);
        const open = openIndex === index;
        return (
          <div className={`bpeRow ${part.staff ? "" : "is-empty"}`} key={`${part.service}-${index}`}>
            {!disabled ? (
              <span className="bpeMove">
                <button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`جلوتر بردن ${part.service}`}>
                  <ChevronUp size={13} strokeWidth={3} />
                </button>
                <button type="button" disabled={index === parts.length - 1} onClick={() => move(index, 1)} aria-label={`عقب‌تر بردن ${part.service}`}>
                  <ChevronDown size={13} strokeWidth={3} />
                </button>
              </span>
            ) : null}
            <ServiceIcon name={part.service} size="sm" />
            <span className="bpeCopy">
              <b>{part.service}</b>
              <small>{toPersianDigits(part.startLabel)} تا {toPersianDigits(part.endLabel)}</small>
            </span>
            <button
              type="button"
              className="bpeWho"
              disabled={disabled}
              aria-expanded={open}
              aria-haspopup="listbox"
              aria-label={`آرتیست ${part.service}: ${part.staff || "بدون آرتیست"}`}
              onClick={() => setOpenIndex(open ? -1 : index)}
            >
              {part.staff ? (
                <span className="scheduleStaffAvatar hasImage" aria-hidden="true">
                  <img src={person?.avatar || person?.staff_avatar || DEFAULT_AVATAR} alt="" />
                </span>
              ) : null}
              <span className="bpeWhoName">{part.staff ? staffLabel(person) || part.staff : "یه آرتیست انتخاب کن"}</span>
              {!disabled ? <ChevronDown size={14} aria-hidden="true" /> : null}
            </button>
            <ArtistPickSheet
              open={open}
              title={`آرتیست ${part.service}`}
              subtitle={`${toPersianDigits(part.startLabel)} تا ${toPersianDigits(part.endLabel)}`}
              onClose={() => setOpenIndex(-1)}
            >
              <ArtistOptionList
                staffOptions={staffOptions}
                current={part.staff}
                availability={availability[index] || null}
                label={`انتخاب آرتیست ${part.service}`}
                onPick={(name, active) => (active ? setOpenIndex(-1) : assign(index, name))}
                onClear={part.staff ? () => assign(index, "") : null}
              />
            </ArtistPickSheet>
          </div>
        );
      })}
    </div>
  );
}
