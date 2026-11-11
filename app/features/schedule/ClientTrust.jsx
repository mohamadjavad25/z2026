"use client";

import { ownerAttendanceState, reliabilityView } from "../../shared/lib/attendance";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Clock3
} from "lucide-react";
import { nowDate } from "../../shared/lib/clock.js";

/**
 * The client's record across frfro and their «میای؟» answer (owner's decision of 2026-10-27): what lets a salon or
 * artist feel sure without a deposit. Only for a client with an account.
 */
export function ClientTrust({ booking }) {
  const record = reliabilityView(booking?.reliability);
  const attend = ownerAttendanceState({ ...booking, booking_date: booking?.booking_date || booking?.dateKey }, nowDate(), booking?.ownerType === "artist" ? "artist" : "salon");
  if (!record && !attend) return null;
  return (
    <div className={`sbmTrust${record?.warn ? " is-warn" : ""}`}>
      {record ? (
        <p>
          {record.warn ? <AlertTriangle size={15} aria-hidden="true" /> : <BadgeCheck size={15} aria-hidden="true" />}
          <span>{record.line}{record.warn ? ` ${record.warn}` : ""}</span>
        </p>
      ) : null}
      {attend ? (
        <p className={`is-${attend}`}>
          {attend === "yes" ? <CheckCircle2 size={15} aria-hidden="true" /> : <Clock3 size={15} aria-hidden="true" />}
          <span>{attend === "yes" ? "روز قبل گفته میاد." : "روز قبل ازش پرسیدیم «میای؟»؛ هنوز جواب نداده. اگه خواستی یه زنگ بزن."}</span>
        </p>
      ) : null}
    </div>
  );
}
