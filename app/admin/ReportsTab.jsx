"use client";

import { useMemo, useState } from "react";
import { Clock3, Link2, Map as MapIcon, Megaphone, Scissors, Sparkles, Store, Target, TrendingUp } from "lucide-react";
import { toPersianDigits } from "../shared/lib/digits";
import { Button } from "../components/ui";
import { BOOKING_TONE, TYPE_LABEL, ago, num } from "./format";
import { Bars } from "./Dashboard";
import { ActivityReport } from "./ActivityReport";
import { PageHead } from "./PageHead";
import { Card, ErrorNote, Loading, Segmented, useAdminData } from "./ui";

const DAYS = ["دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه", "یکشنبه"]; // ISO day 1..7
const WEEK_ORDER = [6, 7, 1, 2, 3, 4, 5]; // shown from Saturday, the Iranian week
const TONE_COLOR = { good: "var(--a-good)", warn: "var(--a-warn)", bad: "var(--a-bad)", info: "var(--a-s1)", muted: "var(--a-faint)" };
const GAP_LABEL = { services: "خدمت ندارد", avatar: "عکس ندارد", posts: "پست ندارد" };
const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

/** When bookings are made: day of the week by hour, darker = more. */
function Heatmap({ cells }) {
  const grid = useMemo(() => {
    const map = new Map(cells.map((cell) => [`${cell.dow}-${cell.hour}`, cell.count]));
    return { get: (dow, hour) => map.get(`${dow}-${hour}`) || 0, max: Math.max(1, ...cells.map((cell) => cell.count)) };
  }, [cells]);
  const busiest = cells.reduce((best, cell) => (cell.count > (best?.count || 0) ? cell : best), null);
  return (
    <>
      <div className="admHeat" role="img" aria-label={busiest ? `شلوغ‌ترین زمان ثبت رزرو: ${DAYS[busiest.dow - 1]} ساعت ${toPersianDigits(busiest.hour)}` : "هنوز رزروی نیست"}>
        <span />
        {Array.from({ length: 24 }, (_, hour) => <small key={hour} className="admHeatHour">{hour % 3 === 0 ? toPersianDigits(hour) : ""}</small>)}
        {WEEK_ORDER.map((dow) => (
          <div key={dow} className="admHeatRow">
            <small>{DAYS[dow - 1]}</small>
            {Array.from({ length: 24 }, (_, hour) => {
              const count = grid.get(dow, hour);
              return <i key={hour} title={`${DAYS[dow - 1]} ساعت ${toPersianDigits(hour)}: ${toPersianDigits(count)} رزرو`} style={{ "--v": count ? 0.15 + (count / grid.max) * 0.85 : 0 }} />;
            })}
          </div>
        ))}
      </div>
      {busiest ? <p className="admMuted">شلوغ‌ترین زمان ثبت رزرو: <b>{DAYS[busiest.dow - 1]}</b> حدود ساعت <b>{toPersianDigits(busiest.hour)}</b>.</p> : null}
    </>
  );
}

// The link pages by their counter tag (landingVisits.js): /go is the reel link, /s the advertising SMS (/s/a → sms-a).
const linkName = (source) => (source === "sms" ? "پیامک" : source.startsWith("sms-") ? <>پیامک <bdi>{source.slice(4)}</bdi></> : source === "go" ? "لینک ریلز" : <bdi>{source}</bdi>);
const shortDay = (day) => new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "long", timeZone: "Asia/Tehran" }).format(new Date(day));

/** What the advertising SMS and the reel link brought, a row per day: opened the link, tapped «شروع», new salons and artists. */
function LinkResults({ rows }) {
  if (!rows.length) return <p className="admMuted">در این بازه کسی لینکی باز نکرده.</p>;
  const sum = (key) => rows.reduce((total, row) => total + row[key], 0);
  return (
    <div className="admTableWrap">
      <table className="admTable">
        <thead><tr><th>روز</th><th>باز کردند</th><th>«شروع»</th><th>سالن تازه</th><th className="admHideNarrow">آرتیست تازه</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.day}>
              <td>{shortDay(row.day)}</td>
              <td><b>{num(row.opened)}</b>{row.sources.map((item) => <small key={item.source}>{linkName(item.source)}{row.sources.length > 1 ? <>: {num(item.opened)}</> : null}</small>)}</td>
              <td>{num(row.started)}{row.opened ? <small>{toPersianDigits(pct(row.started, row.opened))}٪</small> : null}</td>
              <td>{num(row.salons)}</td>
              <td className="admHideNarrow">{num(row.artists)}</td>
            </tr>
          ))}
          <tr>
            <td><b>جمع</b></td><td><b>{num(sum("opened"))}</b></td><td><b>{num(sum("started"))}</b></td><td><b>{num(sum("salons"))}</b></td><td className="admHideNarrow"><b>{num(sum("artists"))}</b></td>
          </tr>
        </tbody>
      </table>
      <p className="admMuted">سالن و آرتیست تازه: همهٔ ثبت‌نام‌های همان روز.</p>
    </div>
  );
}

/** The business at a glance: who brings the bookings, what people book, when, how many new clients book, and who is not ready. */
export function ReportsTab({ onGo }) {
  const [days, setDays] = useState(30);
  const { data, error, reload } = useAdminData(`/api/admin/reports?days=${days}`);
  const head = (
    <PageHead tab="reports">
      <Segmented label="بازهٔ زمانی" value={days} onChange={setDays} options={[{ value: 7, label: "۷ روز" }, { value: 30, label: "۳۰ روز" }, { value: 90, label: "۹۰ روز" }]} />
    </PageHead>
  );
  if (!data) return <>{head}{error ? <ErrorNote error={error} onRetry={reload} /> : <Loading />}</>;
  const { activity, funnel, readiness } = data;
  const totalBookings = data.statuses.reduce((sum, row) => sum + row.count, 0);
  const confirmed = data.statuses.find((row) => row.status === "تایید شده")?.count || 0;

  return (
    <>
      {head}
      <div className="admGrid">
        <div className="admStat"><small>فعال امروز</small><b>{num(activity.dau)}</b><em>{toPersianDigits(pct(activity.dau, activity.total))}٪ از همه</em></div>
        <div className="admStat"><small>فعال این هفته</small><b>{num(activity.wau)}</b><em>{toPersianDigits(pct(activity.wau, activity.total))}٪ از همه</em></div>
        <div className="admStat"><small>فعال این ماه</small><b>{num(activity.mau)}</b><em>از {num(activity.total)} حساب</em></div>
        <div className="admStat"><small>رزرو در {toPersianDigits(days)} روز</small><b>{num(totalBookings)}</b><em>{toPersianDigits(pct(confirmed, totalBookings))}٪ تأییدشده</em></div>
      </div>

      <div className="admTwo">
        <Card title="پرکارترین سالن‌ها و آرتیست‌ها" icon={Store}>
          {data.providers.length ? (
            <div className="admTableWrap">
              <table className="admTable is-clickable">
                <thead><tr><th>نام</th><th>رزرو</th><th>تأیید</th><th className="admHideNarrow">لغو</th><th className="admHideNarrow">بی‌جواب</th></tr></thead>
                <tbody>
                  {data.providers.map((row) => (
                    <tr key={row.id} onClick={() => onGo("users", { id: row.id })}>
                      <td><button type="button" className="admRowLink" onClick={(event) => { event.stopPropagation(); onGo("users", { id: row.id }); }}>{row.name || "بدون نام"}</button><small>{TYPE_LABEL[row.type]}{row.area ? ` • ${row.area}` : ""}</small></td>
                      <td><b>{num(row.total)}</b></td>
                      <td>{toPersianDigits(pct(row.confirmed, row.total))}٪</td>
                      <td className="admHideNarrow">{num(row.cancelled)}</td>
                      <td className="admHideNarrow">{row.expired ? <span className="admTone is-warn">{num(row.expired)}</span> : "۰"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="admMuted">در این بازه رزروی ثبت نشده.</p>}
        </Card>
        <Card title="قیف مشتری‌های تازه" icon={Target}>
          <p className="admMuted">از مشتری‌هایی که در {toPersianDigits(days)} روز اخیر ثبت‌نام کرده‌اند:</p>
          <ul className="admFunnel">
            <li style={{ "--w": "100%" }}><span>ثبت‌نام کرده‌اند</span><b>{num(funnel.clients)}</b></li>
            <li style={{ "--w": `${Math.max(4, pct(funnel.returning, funnel.clients))}%` }}><span>این هفته برگشته‌اند</span><b>{num(funnel.returning)} <small>({toPersianDigits(pct(funnel.returning, funnel.clients))}٪)</small></b></li>
            <li style={{ "--w": `${Math.max(4, pct(funnel.booked, funnel.clients))}%` }}><span>دست‌کم یک رزرو</span><b>{num(funnel.booked)} <small>({toPersianDigits(pct(funnel.booked, funnel.clients))}٪)</small></b></li>
          </ul>
        </Card>
      </div>

      <Card title="نتیجهٔ پیامک تبلیغی و لینک‌ها" icon={Link2}>
        <LinkResults rows={data.links || []} />
      </Card>

      <ActivityReport days={days} />

      <Card title="ساعت‌های ثبت رزرو" icon={Clock3}>
        <Heatmap cells={data.heat} />
      </Card>

      <div className="admTwo is-even">
        <Card title="پرطرفدارترین خدمت‌ها" icon={Scissors}>
          <Bars rows={data.services.map((row) => ({ ...row, type: row.service }))} labelOf={(row) => row.service} colorOf={() => "var(--a-s2)"} onPick={(row) => onGo("bookings", { q: row.service })} />
        </Card>
        <Card title="وضعیت رزروها" icon={TrendingUp}>
          <Bars rows={data.statuses} labelOf={(row) => row.status} colorOf={(row) => TONE_COLOR[BOOKING_TONE[row.status]] || "var(--a-accent)"} onPick={(row) => onGo("bookings", { status: row.status })} />
        </Card>
      </div>

      <div className="admTwo">
        <Card
          title={`آمادگی سالن‌ها و آرتیست‌ها: ${num(readiness.ready)} از ${num(readiness.pros)} کامل`}
          icon={Sparkles}
          actions={readiness.noServices ? <Button size="sm" variant="secondary" onClick={() => onGo("broadcast", { segment: "incomplete" })}><Megaphone size={15} aria-hidden="true" /> پیام به بی‌خدمت‌ها</Button> : null}
        >
          <div className="admReadyBar" aria-hidden="true"><i style={{ width: `${pct(readiness.ready, readiness.pros)}%` }} /></div>
          <div className="admMiniStats">
            <div><b>{num(readiness.noServices)}</b><small>بدون خدمت</small></div>
            <div><b>{num(readiness.noAvatar)}</b><small>بدون عکس</small></div>
            <div><b>{num(readiness.noPosts)}</b><small>بدون پست</small></div>
          </div>
          {readiness.list.length ? (
            <ul className="admRows">
              {readiness.list.map((row) => (
                <li key={row.id}>
                  <button type="button" onClick={() => onGo("users", { id: row.id })}>
                    <span>{row.name || "بدون نام"} <small>{TYPE_LABEL[row.type]} • {ago(row.created_at)}</small></span>
                    <span className="admGaps">{row.gaps.map((gap) => <span key={gap} className={`admTone is-${gap === "services" ? "bad" : "warn"}`}>{GAP_LABEL[gap]}</span>)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="admMuted">همه کامل‌اند.</p>}
        </Card>
        <Card title="منطقه‌ها" icon={MapIcon}>
          {data.areas.length ? (
            <ul className="admTables">
              <li className="is-head"><span>منطقه</span><b>مشتری</b><small>سالن و آرتیست</small></li>
              {data.areas.map((row) => (
                <li key={row.area}><span>{row.area}</span><b>{num(row.clients)}</b><small>{num(row.pros)}</small></li>
              ))}
            </ul>
          ) : <p className="admMuted">داده‌ای نیست.</p>}
        </Card>
      </div>
    </>
  );
}
