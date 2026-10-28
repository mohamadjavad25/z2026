"use client";

import { toPersianDigits } from "../../shared/lib/digits";
import { hourOnly, memberToday, weekFromHours } from "./teamWeek";

/** «۱۰:۰۰» or «۱۰» → minutes from midnight; null when it is not a time. */
function minutes(time) {
  const m = String(time || "").replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).match(/^(\d{1,2})(?::(\d{2}))?/);
  return m ? Number(m[1]) * 60 + Number(m[2] || 0) : null;
}

/**
 * «امروز تیم»: each member's hours today as a bar over the salon's open hours (owner's choice 2026-10-28). Only hours and
 * who is in; no booking or money numbers (owner's decision 2026-10-25). Tapping a row opens that member's page.
 */
export function SalonTeamToday({ staffList = [], salonHours = [], onOpen }) {
  const now = new Date();
  const todaySalon = weekFromHours(salonHours, now).find((item) => item.today);
  const from = minutes(todaySalon?.open) ?? 10 * 60;
  const to = minutes(todaySalon?.close) ?? 20 * 60;
  const span = Math.max(60, to - from);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowPct = Math.min(100, Math.max(0, ((nowMin - from) / span) * 100));
  const showNow = nowMin >= from && nowMin <= to;
  const ticks = [];
  for (let m = Math.ceil(from / 120) * 120; m <= to; m += 120) ticks.push(m);

  return (
    <div className="twDayView">
      <div className="twAxis" aria-hidden="true">
        {ticks.map((m) => <span key={m} style={{ insetInlineStart: `${((m - from) / span) * 100}%` }}>{toPersianDigits(Math.floor(m / 60))}</span>)}
      </div>
      {staffList.map((person) => {
        const week = weekFromHours(person.hours || [], now);
        const today = week.find((item) => item.today);
        const status = memberToday(person, week);
        const start = minutes(today?.open);
        const end = minutes(today?.close);
        const working = status.tone === "ok" && !person.hours?.length ? true : status.tone === "ok" && start != null && end != null;
        const a = person.hours?.length && start != null ? Math.max(from, start) : from;
        const b = person.hours?.length && end != null ? Math.min(to, end) : to;
        const name = person.artist_name || person.name;
        return (
          <button type="button" className="twTodayRow" key={person.id || person.name} onClick={() => onOpen?.(person)}>
            <span className="twTodayName">{name}</span>
            <span className="twTrack">
              {working && b > a ? (
                <span className="twBar" style={{ insetInlineStart: `${((a - from) / span) * 100}%`, width: `${((b - a) / span) * 100}%` }}>
                  {today?.open ? `${toPersianDigits(hourOnly(today.open))} تا ${toPersianDigits(hourOnly(today.close))}` : "سرکاره"}
                </span>
              ) : (
                <span className={`twBar is-${status.tone}`} style={{ insetInlineStart: 0, width: "100%" }}>{status.text}</span>
              )}
              {showNow ? <i className="twNow" style={{ insetInlineStart: `${nowPct}%` }} aria-hidden="true" /> : null}
            </span>
          </button>
        );
      })}
      <p className="twTodayNote">خط صورتی یعنی الان. لمس هر ردیف صفحهٔ همون آرتیست رو باز می‌کنه.</p>
    </div>
  );
}
