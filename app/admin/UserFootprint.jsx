"use client";

import { fmtDate, num } from "./format";
import { ErrorNote, Loading, useAdminData } from "./ui";
import { activityLabel, deviceLabel, durationLabel, sourceLabel } from "./activityLabels";
import { toPersianDigits } from "../shared/lib/digits";

const clock = (value) => toPersianDigits(new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran" }));
const seconds = (from, to) => (new Date(to) - new Date(from)) / 1000;

/** The «رد پا» pane of a person: every visit, what happened in it, and who saw their public page. */
export function UserFootprint({ userId, provider }) {
  const { data, error, reload } = useAdminData(`/api/admin/users/${userId}/footprint`);
  if (!data) return error ? <ErrorNote error={error} onRetry={reload} /> : <Loading />;
  const { totals, visits, page } = data;
  return (
    <section className="admFootprint">
      {visits.length ? (
        <p className="admMuted">{num(totals.visits)} بار اومده، روی هم {durationLabel(totals.seconds)}.{totals.visits > visits.length ? ` ${num(visits.length)} بار آخر این پایینه.` : ""}</p>
      ) : <p className="admMuted">هنوز رد پایی ثبت نشده.</p>}
      {provider ? <p className="admFootprintPage">صفحهٔ عمومیش: {num(page.viewers)} نفر دیدن، {num(page.book_taps)} نفر «رزرو» رو زدن.</p> : null}
      {visits.map((visit) => (
        <article key={visit.id} className="admVisit">
          <header>
            <b>{fmtDate(visit.started_at)}</b>
            <small>تا {clock(visit.last_at)} • {durationLabel(seconds(visit.started_at, visit.last_at))} • {deviceLabel(visit.device)} • {sourceLabel(visit.source)}</small>
          </header>
          {visit.events.length ? (
            <ol>
              {visit.events.map((event, index) => (
                <li key={index} className={event.kind === "action" ? "is-action" : ""}>
                  <time>{clock(event.at)}</time>
                  <span>{activityLabel(event.kind, event.name)}</span>
                </li>
              ))}
            </ol>
          ) : <p className="admMuted">فقط برنامه رو باز کرد.</p>}
        </article>
      ))}
    </section>
  );
}
