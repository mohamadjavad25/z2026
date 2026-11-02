"use client";

import { useEffect, useRef } from "react";
import { CalendarX } from "lucide-react";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";
import { clockText } from "./visitBookerModel";

/* The small pieces of the client's step form (ClientVisitWizard.jsx): how a day reads, and the notices it shows. */

/** The days that say how many free times they have (owner's decision of 2026-11-02); later ones come under «روزهای بعد». */
export const COUNTED_DAYS = 14;

export const fa = (value) => toPersianDigits(String(value));
export const telHref = (phone) => `tel:${toLatinDigits(String(phone || "")).replace(/[^\d+]/g, "")}`;
/** A day as its two lines: «امروز» / «۱۱ آبان». */
export const dayShort = (day) => day?.short || String(day?.label || "").split(" ")[0];
export const dayDate = (day) => day?.date || String(day?.label || "").split(" ").slice(1).join(" ");
/** «امروز»، «فردا» alone; any other day with its date. */
export const dayName = (day) => (!day ? "" : ["امروز", "فردا"].includes(dayShort(day)) ? dayShort(day) : day.label);
export const minutesText = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${fa(rest)} دقیقه`;
  return `${fa(hours)} ساعت${rest ? ` و ${fa(rest)} دقیقه` : ""}`;
};

/** What a day says under its date: «تعطیل», «پر», «۴ وقت», or nothing yet. */
export function dayStatus(day, counts) {
  if (day.closed) return { text: "تعطیل", tone: "off" };
  if (counts.status !== "ready" || !(day.value in counts.byDay)) return { text: counts.status === "loading" ? "…" : "", tone: "" };
  const count = counts.byDay[day.value];
  if (!count) return { text: "پر", tone: "off" };
  return { text: `${fa(count)} وقت`, tone: count <= 2 ? "few" : "free" };
}

/**
 * No free day in the next two weeks for these picks (said before the client meets a calendar of «پر»): services that
 * can never fit one day (`tooLong`, their total) are asked to be split; a group with no common time is offered back to
 * back; anything else is pointed at the later days, with the salon's number when it is shown.
 */
export function NoRoom({ count, people = 1, tooLong = "", placeName = "", phone = "", onChain }) {
  let text;
  if (tooLong) text = `این ${fa(count)} کار پشت‌سرهم ${tooLong} می‌شه و توی یه روزِ ${placeName || "سالن"} جا نمی‌شه. چندتاش رو بردار و بقیه رو یه نوبت دیگه بگیر.`;
  else if (people > 1) text = `برای ${fa(people)} نفر با هم تا دو هفتهٔ دیگه ساعت مشترک نیست. ${people === 2 ? "دو" : "سه"} تا نوبت پشت‌سرهم بگیریم؟`;
  else text = `تا دو هفتهٔ دیگه برای ${count > 1 ? `این ${fa(count)} کار با هم` : "این کار"} جا نیست. ${count > 1 ? "یکی رو بردار، یا " : ""}روزهای بعد رو ببین${phone ? " یا به سالن زنگ بزن" : ""}.`;
  return (
    <div className="vbNoRoom" role="status">
      <CalendarX size={22} aria-hidden="true" />
      <p>{text}</p>
      {people > 1 && !tooLong ? <button type="button" className="vbAction is-primary" onClick={onChain}>آره، پشت‌سرهم</button> : null}
      {people < 2 && !tooLong && phone ? <a className="vbAction" href={telHref(phone)}>تماس</a> : null}
    </div>
  );
}

/** The days as one sideways row above the hours, each with its count, to switch day without going back. */
export function DayRail({ days, counts, value, onPick }) {
  const railRef = useRef(null);
  useEffect(() => {
    railRef.current?.querySelector(".is-on")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, []);
  return (
    <div className="vbDayRail" ref={railRef} role="group" aria-label="روز">
      {days.map((item, position) => {
        const status = position < COUNTED_DAYS ? dayStatus(item, counts) : { text: item.closed ? "تعطیل" : "" };
        return (
          <button
            type="button"
            key={item.value}
            aria-pressed={value === item.value}
            aria-disabled={item.closed || undefined}
            className={`vbDay${value === item.value ? " is-on" : ""}${item.closed ? " is-closed" : ""}`}
            onClick={() => {
              if (!item.closed && item.value !== value) onPick(item.value);
            }}
          >
            {dayName(item)}
            {status.text ? <small>{status.text}</small> : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The chosen time was taken while sending (owner's wording of 2026-11-02): one time left is named with a button to take
 * it, several ask to pick one, none sends to another day.
 */
export function TakenNotice({ taken, day, left, onTake, onOtherDay }) {
  const gone = `${clockText(taken)} همین الان پر شد.`;
  const where = dayName(day) || "این روز";
  if (!left.length) {
    return (
      <div className="vbTaken" role="alert">
        <p>{gone} {where} دیگه ساعت خالی نمونده؛ یه روز دیگه رو ببین.</p>
        <button type="button" className="vbAction is-primary" onClick={onOtherDay}>یه روز دیگه</button>
      </div>
    );
  }
  if (left.length === 1) {
    return (
      <div className="vbTaken" role="alert">
        <p>{gone} {where} فقط ساعت {clockText(left[0])} مونده.</p>
        <button type="button" className="vbAction is-primary" onClick={() => onTake(left[0])}>همین {clockText(left[0])} رو می‌خوام</button>
      </div>
    );
  }
  return (
    <div className="vbTaken" role="alert">
      <p>{gone} {where} هنوز {fa(left.length)} تا ساعت دیگه خالیه؛ یکی رو انتخاب کن.</p>
    </div>
  );
}
