"use client";

import { Footprints, LogOut, Share2, Target } from "lucide-react";
import { toPersianDigits } from "../shared/lib/digits";
import { num } from "./format";
import { Card, ErrorNote, Loading, useAdminData } from "./ui";
import { durationLabel, screenLabel, sourceLabel } from "./activityLabels";

const STEPS = [["signed", "ثبت‌نام کردن"], ["services", "خدمت گذاشتن"], ["posts", "نمونه‌کار گذاشتن"], ["shared", "لینکشون رو فرستادن"], ["booked", "اولین نوبت رو گرفتن"]];
const ROLE = { artist: "آرتیست‌ها", salon: "سالن‌ها" };
const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

/** The step that loses the most people: the next thing to work on. */
function biggestDrop(row) {
  let worst = null;
  let lost = 0;
  STEPS.slice(1).forEach(([key], index) => {
    const gone = row[STEPS[index][0]] - row[key];
    if (gone > lost) {
      lost = gone;
      worst = key;
    }
  });
  return worst;
}

function Funnel({ row }) {
  const drop = biggestDrop(row);
  return (
    <ul className="admFunnel">
      {STEPS.map(([key, label]) => (
        <li key={key} className={key === drop ? "is-drop" : ""} style={{ "--w": `${Math.max(4, pct(row[key], row.signed))}%` }}>
          <span>{label}</span><b>{num(row[key])}</b>
        </li>
      ))}
    </ul>
  );
}

function CountList({ rows, label, empty }) {
  return rows.length ? (
    <ul className="admFacts">
      {rows.map((row) => <li key={row.name ?? row.source}><span>{label(row)}</span><b>{num(row.count)}</b></li>)}
    </ul>
  ) : <p className="admMuted">{empty}</p>;
}

/** «کجا می‌مونن» on the reports page. Test accounts are not in these numbers. */
export function ActivityReport({ days }) {
  const { data, error, reload } = useAdminData(`/api/admin/activity?days=${days}`);
  if (!data) return error ? <ErrorNote error={error} onRetry={reload} /> : <Loading />;
  const { summary, sources, lastScreens, funnels } = data;
  return (
    <>
      <Card title="کجا می‌مونن" icon={Footprints}>
        <p className="admMuted">
          {toPersianDigits(days)} روز اخیر، بدون حساب‌های تست: {num(summary.people)} نفر، {num(summary.visits)} بار اومدن؛ هر بار حدود {durationLabel(summary.avg_seconds)}.
          {" "}{num(summary.accounts)} نفرشون حساب دارن.
        </p>
      </Card>
      <div className="admTwo">
        {["artist", "salon"].map((type) => {
          const row = funnels.find((item) => item.type === type);
          return (
            <Card key={type} title={ROLE[type]} icon={Target}>
              {row ? <Funnel row={row} /> : <p className="admMuted">توی این بازه کسی ثبت‌نام نکرده.</p>}
              {row ? <p className="admMuted">صورتی یعنی بیشترین ریزش همین‌جاست.</p> : null}
            </Card>
          );
        })}
      </div>
      <div className="admTwo">
        <Card title="از کجا میان" icon={Share2}>
          <CountList rows={sources} label={(row) => sourceLabel(row.source)} empty="هنوز رد پایی ثبت نشده." />
        </Card>
        <Card title="آخرین صفحه قبل از رفتن" icon={LogOut}>
          <CountList rows={lastScreens} label={(row) => screenLabel(row.name)} empty="هنوز رد پایی ثبت نشده." />
        </Card>
      </div>
    </>
  );
}
