"use client";

import { useState } from "react";
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

  return (
    <div className="bpeList" role="listbox" aria-label={label}>
      {people.map((option) => {
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
            {info ? (
              <span className="bpeTags">
                {info.skilled ? <i className="is-skill">کار همین خدمت</i> : null}
                {info.away ? <i className="is-away">{info.away}</i> : null}
                {active ? null : info.free ? <i className="is-free">آزاد</i> : <i className="is-busy">نوبت داره</i>}
              </span>
            ) : null}
            {active ? <Check size={16} /> : null}
          </button>
        );
      })}
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
  // «همه با …» only when that artist is free for every service (or availability is unknown).
  const canGiveAll = firstStaff && !allSame && parts.every((part, index) => {
    const info = availability[index]?.get(firstStaff);
    return !info || info.free || part.staff === firstStaff;
  });

  return (
    <div className="bpeBox">
      <div className="bpeHead">
        <span>
          <b>تقسیم بین آرتیست‌ها</b>
          <small>کارها پشت سر هم از {toPersianDigits(parts[0].startLabel)} شروع می‌شن.</small>
        </span>
        {!disabled && canGiveAll ? (
          <button type="button" className="bpeAll" onClick={() => giveAllTo(firstStaff)}>همه با {firstStaff}</button>
        ) : null}
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
            {open ? (
              <ArtistOptionList
                staffOptions={staffOptions}
                current={part.staff}
                availability={availability[index] || null}
                label={`انتخاب آرتیست ${part.service}`}
                onPick={(name, active) => (active ? setOpenIndex(-1) : assign(index, name))}
                onClear={part.staff ? () => assign(index, "") : null}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
