"use client";

import { useState } from "react";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";
import { usePolling } from "../../shared/lib/usePolling";
import { getSalonDirectVisits } from "../../shared/api/salons";
import { timeLabelToMinutes } from "../../shared/lib/time";

const firstWord = (name) => String(name || "").trim().split(/\s+/)[0] || "";

/** The end of a visit as a clock label ("۱۱:۳۰"), from its start and length. */
function endLabel(time, minutes) {
  const end = timeLabelToMinutes(time) + (Number(minutes) || 60);
  const hh = String(Math.floor(end / 60) % 24).padStart(2, "0");
  const mm = String(end % 60).padStart(2, "0");
  return toPersianDigits(`${hh}:${mm}`);
}

/**
 * The salon's team's own clients for the salon's day list (owner's decision of 2026-10-25), polled every 30 seconds:
 * { visits, busy } from GET /api/salon-staff/direct. Empty lists until it loads.
 */
export function useTeamClientTimes() {
  const [data, setData] = useState({ visits: [], busy: [] });
  usePolling(async () => {
    const { ok, data: next } = await getSalonDirectVisits();
    if (ok && next) setData({ visits: Array.isArray(next.visits) ? next.visits : [], busy: Array.isArray(next.busy) ? next.busy : [] });
  }, 30000);
  return data;
}

/** A team member's own client received at the salon: a violet row «مشتری نگار» with the time, service and first name. */
export function TeamVisitRow({ visit }) {
  const artist = firstWord(visit.artistName) || "آرتیست";
  return (
    <div role="group" className="plTeamRow is-visit" aria-label={`مشتری ${artist}`}>
      <span className="plTeamTime">
        <b>{toPersianDigits(toLatinDigits(visit.time))}</b>
        <small>تا {endLabel(visit.time, visit.minutes)}</small>
      </span>
      <span className="plTeamText">
        <span className="plTeamTag">مشتری {artist}</span>
        <b>{visit.clientFirstName || "مشتری"}{visit.service ? `، ${visit.service}` : ""}</b>
        <small>{artist} خودش این نوبت رو گرفته و جوابش رو می‌ده.</small>
      </span>
    </div>
  );
}

/** A team member busy with their own client elsewhere: a striped row, only when and how long. */
export function TeamBusyRow({ item }) {
  const artist = firstWord(item.artistName) || "آرتیست";
  return (
    <div role="group" className="plTeamRow is-busy" aria-label={`${artist} سرش شلوغه`}>
      <span className="plTeamTime">
        <b>{toPersianDigits(toLatinDigits(item.time))}</b>
        <small>تا {endLabel(item.time, item.minutes)}</small>
      </span>
      <span className="plTeamText">
        <b>{artist} سرش شلوغه</b>
        <small>مشتری خودشه، جای دیگه. این ساعت رو به {artist} نده.</small>
      </span>
    </div>
  );
}
