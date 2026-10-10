"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { toPersianDigits } from "../../shared/lib/digits";
import { scheduleBookingParts } from "../../shared/lib/bookingParts";

const DEFAULT_AVATAR = "/profile-icon.svg";

function staffLabel(person) {
  return person?.artist_name || person?.name || "";
}

/**
 * «تقسیم بین آرتیست‌ها» in the booking menu of a multi-service booking: one row per service with
 * its clock range (back to back from the booking's start, in this order), its artist, and arrows
 * to reorder. Every change is sent straight away as the whole new list (`onChange(parts)`); the
 * server checks each artist is free and refuses the change otherwise.
 */
export function BookingPartsEditor({ booking, staffOptions = [], disabled = false, onChange }) {
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

  return (
    <div className="bpeBox">
      <div className="bpeHead">
        <span>
          <b>تقسیم بین آرتیست‌ها</b>
          <small>ساعت هر خدمت پشت سر هم از {toPersianDigits(parts[0].startLabel)} حساب می‌شود.</small>
        </span>
        {!disabled && firstStaff && !allSame ? (
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
              <span className="bpeWhoName">{part.staff ? staffLabel(person) || part.staff : "بدون آرتیست"}</span>
              {!disabled ? <ChevronDown size={14} aria-hidden="true" /> : null}
            </button>
            {open ? (
              <div className="bpeList" role="listbox" aria-label={`انتخاب آرتیست ${part.service}`}>
                {staffOptions.map((option) => {
                  const active = option.name === part.staff;
                  return (
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      key={option.id || option.name}
                      className={active ? "is-selected" : ""}
                      onClick={() => (active ? setOpenIndex(-1) : assign(index, option.name))}
                    >
                      <span className="scheduleStaffAvatar hasImage" aria-hidden="true">
                        <img src={option.avatar || option.staff_avatar || DEFAULT_AVATAR} alt="" />
                      </span>
                      <span className="bpeOption">
                        <b>{staffLabel(option)}</b>
                        <small>{option.role || option.artist_service || "آرتیست"}</small>
                      </span>
                      {active ? <Check size={16} /> : null}
                    </button>
                  );
                })}
                {part.staff ? (
                  <button type="button" role="option" aria-selected={false} onClick={() => assign(index, "")}>
                    <span className="bpeOption"><b>بدون آرتیست</b><small>سالن خودش انجام می‌دهد</small></span>
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
