"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Activity, CalendarCheck, CircleCheck, Image as ImageIcon, ShieldCheck, TriangleAlert, UserPlus, Users } from "lucide-react";
import { apiFetch } from "../shared/api/client";
import { toPersianDigits } from "../shared/lib/digits";
import { Button, Chip } from "../components/ui";
import { ACTION_LABEL, TYPE_LABEL, num } from "./format";

const SERIES = [
  { key: "signups", label: "ثبت‌نام", color: "var(--a-s1)", dash: "" },
  { key: "bookings", label: "رزرو", color: "var(--a-s2)", dash: "7 5" }
];
const TYPE_COLOR = { client: "var(--a-s1)", artist: "var(--a-s2)", salon: "var(--a-s3)" };

const TEHRAN = { timeZone: "Asia/Tehran" };
const dayLabel = (day) => new Intl.DateTimeFormat("fa-IR", { month: "short", day: "numeric", ...TEHRAN }).format(new Date(`${day}T12:00:00+03:30`));
const longDate = () => new Intl.DateTimeFormat("fa-IR", { weekday: "long", year: "numeric", month: "long", day: "numeric", ...TEHRAN }).format(new Date());

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, ...TEHRAN }).format(new Date()));
  if (hour < 5) return "شب بخیر";
  if (hour < 12) return "صبح بخیر";
  if (hour < 17) return "ظهر بخیر";
  if (hour < 20) return "عصر بخیر";
  return "شب بخیر";
}

function ago(value) {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("fa", { numeric: "auto" });
  const abs = Math.abs(seconds);
  if (abs < 60) return "همین الان";
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  return rtf.format(Math.round(seconds / 86400), "day");
}

/** Monotone cubic curve through the points (never overshoots below zero or above a peak). */
function smoothPath(points) {
  const n = points.length;
  if (n < 2) return "";
  const dx = [];
  const m = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx[i] = points[i + 1].x - points[i].x;
    m[i] = (points[i + 1].y - points[i].y) / dx[i];
  }
  const t = [m[0]];
  for (let i = 1; i < n - 1; i += 1) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  t[n - 1] = m[n - 2];
  for (let i = 0; i < n - 1; i += 1) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
    } else {
      const a = t[i] / m[i];
      const b = t[i + 1] / m[i];
      const s = a * a + b * b;
      if (s > 9) {
        const tau = 3 / Math.sqrt(s);
        t[i] = tau * a * m[i];
        t[i + 1] = tau * b * m[i];
      }
    }
  }
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < n - 1; i += 1) {
    d += ` C${points[i].x + dx[i] / 3},${points[i].y + (t[i] * dx[i]) / 3} ${points[i + 1].x - dx[i] / 3},${points[i + 1].y - (t[i + 1] * dx[i]) / 3} ${points[i + 1].x},${points[i + 1].y}`;
  }
  return d;
}

function Delta({ change }) {
  if (change === null) return <span className="admDelta is-up">جدید</span>;
  if (change === 0) return <span className="admDelta">بدون تغییر</span>;
  const up = change > 0;
  return (
    <span className={`admDelta ${up ? "is-up" : "is-down"}`}>
      <span aria-hidden="true">{up ? "▲" : "▼"}</span> {toPersianDigits(Math.abs(change))}٪
      <span className="srOnly"> {up ? "افزایش" : "کاهش"} نسبت به دورهٔ قبل</span>
    </span>
  );
}

function Spark({ values, tint }) {
  const id = useId();
  const max = Math.max(1, ...values);
  const pts = values.map((value, index) => ({ x: (index / Math.max(1, values.length - 1)) * 100, y: 36 - (value / max) * 30 }));
  const line = smoothPath(pts);
  return (
    <svg className="admSpark" viewBox="0 0 100 44" preserveAspectRatio="none" aria-hidden="true" style={{ color: tint }}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {line ? <path d={`${line} L100,44 L0,44 Z`} fill={`url(#${id})`} /> : null}
      {line ? <path d={line} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" /> : null}
    </svg>
  );
}

function Kpi({ label, value, change, hint, values, tint, Icon }) {
  return (
    <div className="admStat admKpi" style={{ "--tint": tint }}>
      <div className="admKpiHead">
        <span className="admKpiIcon"><Icon size={18} aria-hidden="true" /></span>
        <small>{label}</small>
      </div>
      <b>{num(value)}</b>
      <div className="admKpiRow">
        {change === undefined ? null : <Delta change={change} />}
        {hint ? <em>{hint}</em> : null}
      </div>
      {values ? <Spark values={values} tint={tint} /> : <div style={{ height: 14 }} />}
    </div>
  );
}

function TrendChart({ series }) {
  const id = useId();
  const ref = useRef(null);
  const [hover, setHover] = useState(null);
  const W = 720;
  const H = 260;
  const pad = { l: 40, r: 12, t: 16, b: 30 };
  const n = series.length;
  const max = Math.max(1, ...series.flatMap((row) => SERIES.map((line) => row[line.key])));
  const niceMax = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  const x = (index) => pad.l + (n === 1 ? 0 : (index / (n - 1)) * (W - pad.l - pad.r));
  const y = (value) => pad.t + (1 - value / niceMax) * (H - pad.t - pad.b);
  const ticks = [0, 1, 2, 3, 4].map((step) => (niceMax / 4) * step);
  const labelEvery = n > 14 ? 5 : n > 8 ? 2 : 1;
  const totals = SERIES.map((line) => `${line.label} ${toPersianDigits(series.reduce((sum, row) => sum + row[line.key], 0))}`).join("، ");

  function locate(clientX) {
    const rect = ref.current.getBoundingClientRect();
    const vx = ((clientX - rect.left) / rect.width) * W;
    setHover(Math.min(n - 1, Math.max(0, Math.round(((vx - pad.l) / (W - pad.l - pad.r)) * (n - 1)))));
  }
  function onKey(event) {
    if (event.key === "ArrowLeft") setHover((value) => Math.max(0, (value ?? n) - 1));
    else if (event.key === "ArrowRight") setHover((value) => Math.min(n - 1, (value ?? -1) + 1));
    else if (event.key === "Escape") setHover(null);
    else return;
    event.preventDefault();
  }

  const row = hover === null ? null : series[hover];
  return (
    <div className="admChartWrap">
      <svg
        ref={ref}
        className="admChart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        tabIndex={0}
        aria-label={`روند ${toPersianDigits(n)} روز گذشته؛ جمع: ${totals}. با کلیدهای چپ و راست روی روزها حرکت کن.`}
        onPointerMove={(event) => locate(event.clientX)}
        onPointerDown={(event) => locate(event.clientX)}
        onPointerLeave={() => setHover(null)}
        onBlur={() => setHover(null)}
        onKeyDown={onKey}
      >
        <defs>
          {SERIES.map((line) => (
            <linearGradient key={line.key} id={`${id}-${line.key}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={line.color} stopOpacity={line.key === "signups" ? 0.32 : 0.16} />
              <stop offset="1" stopColor={line.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="grid" x1={pad.l} x2={W - pad.r} y1={y(tick)} y2={y(tick)} />
            <text x={pad.l - 10} y={y(tick) + 4} textAnchor="end">{toPersianDigits(Math.round(tick))}</text>
          </g>
        ))}
        {series.map((item, index) => (index % labelEvery === 0 || index === n - 1 ? <text key={item.day} x={x(index)} y={H - 8} textAnchor="middle">{dayLabel(item.day)}</text> : null))}
        {SERIES.map((line) => {
          const pts = series.map((item, index) => ({ x: x(index), y: y(item[line.key]) }));
          const path = smoothPath(pts);
          return (
            <g key={line.key}>
              {path ? <path d={`${path} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#${id}-${line.key})`} /> : null}
              {path ? <path d={path} fill="none" stroke={line.color} strokeWidth="2.75" strokeDasharray={line.dash} strokeLinecap="round" /> : null}
            </g>
          );
        })}
        {hover !== null ? (
          <g>
            <line className="cross" x1={x(hover)} x2={x(hover)} y1={pad.t} y2={y(0)} />
            {SERIES.map((line) => (
              <circle key={line.key} cx={x(hover)} cy={y(row[line.key])} r="5.5" fill="var(--a-card)" stroke={line.color} strokeWidth="3" />
            ))}
          </g>
        ) : null}
      </svg>
      {row ? (
        <div className="admTip" role="status" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <b>{dayLabel(row.day)}</b>
          {SERIES.map((line) => (
            <span key={line.key}><span><i style={{ background: line.color }} />{line.label}</span><b>{toPersianDigits(row[line.key])}</b></span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const FEED = {
  signup: { Icon: UserPlus, label: "ثبت‌نام جدید" },
  booking: { Icon: CalendarCheck, label: "رزرو جدید" },
  post: { Icon: ImageIcon, label: "پست جدید" },
  admin: { Icon: ShieldCheck, label: "عملیات مدیریتی" }
};

function Bars({ rows, labelOf, colorOf }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  if (!rows.length) return <p className="admMuted">داده‌ای نیست.</p>;
  return (
    <ul className="admBarsH">
      {rows.map((row) => (
        <li key={row.type || row.status} style={{ "--bar": colorOf(row) }}>
          <i style={{ width: `${Math.max(6, (row.count / max) * 100)}%` }} aria-hidden="true" />
          <span>{labelOf(row)}</span>
          <b>{num(row.count)}</b>
        </li>
      ))}
    </ul>
  );
}

/** The admin home: a greeting, things that need attention, numbers vs the previous period, trend, a 7-day forecast and recent activity. */
export function Dashboard({ onGo, name }) {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [tableView, setTableView] = useState(false);

  useEffect(() => {
    let live = true;
    apiFetch(`/api/admin/dashboard?days=${days}`).then(({ ok, payload }) => {
      if (!live) return;
      if (ok) {
        setData(payload.data);
        setFailed(false);
      } else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [days]);

  const first = String(name || "").trim().split(/\s+/)[0];
  const hello = (
    <header className="admHead">
      <div className="admHello">
        <p>{longDate()}</p>
        <h1>{greeting()}{first ? <>، <em>{first}</em></> : null}</h1>
      </div>
      <div className="admChips" role="group" aria-label="بازهٔ زمانی">
        {[7, 30].map((value) => (
          <Chip key={value} selected={days === value} onClick={() => setDays(value)}>{toPersianDigits(value)} روز گذشته</Chip>
        ))}
      </div>
    </header>
  );

  if (failed) return <div className="admDash">{hello}<p className="admError" role="alert">بارگذاری داشبورد انجام نشد.</p></div>;
  if (!data) return <div className="admDash">{hello}<p className="admMuted">در حال بارگذاری…</p></div>;

  const { kpis, totals, series, alerts, forecast } = data;
  const attention = [
    { n: alerts.pendingResets, text: "درخواست بازیابی رمز منتظر پیگیری", go: "resets" },
    { n: alerts.adminFailedLogins, text: "تلاش ناموفق ورود به پنل در ۲۴ ساعت", go: "security" },
    { n: alerts.smsFailed, text: "پیامک ناموفق در ۲۴ ساعت", go: null },
    { n: alerts.suspended, text: "حساب مسدود", go: "users" },
    { n: alerts.hiddenPosts, text: "پست پنهان‌شده", go: "content" }
  ].filter((item) => item.n > 0);
  const col = (key) => series.map((row) => row[key]);

  return (
    <div className="admDash">
      {hello}

      {attention.length ? (
        <section className="admCard admAttention" aria-label="نیازمند توجه">
          <h2><TriangleAlert size={18} aria-hidden="true" /> نیازمند توجه</h2>
          <ul>
            {attention.map((item) => (
              <li key={item.text}>
                <b>{num(item.n)}</b> {item.text}
                {item.go ? <button type="button" className="admLink" onClick={() => onGo(item.go)}>بررسی ←</button> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="admNote admOk" role="status"><CircleCheck size={18} aria-hidden="true" /> همه‌چیز عادی است؛ موردی نیازمند توجه نیست.</p>
      )}

      <div className="admGrid">
        <Kpi label="کل کاربران" value={totals.users} hint={`${num(kpis.signups.value)} جدید`} change={kpis.signups.change} values={col("signups")} tint="var(--a-s1)" Icon={Users} />
        <Kpi label="رزروها" value={kpis.bookings.value} hint={`از ${num(totals.bookings)} کل`} change={kpis.bookings.change} values={col("bookings")} tint="var(--a-s2)" Icon={CalendarCheck} />
        <Kpi label="پست‌های جدید" value={kpis.posts.value} hint={`از ${num(totals.posts)} کل`} change={kpis.posts.change} values={col("posts")} tint="var(--a-s3)" Icon={ImageIcon} />
        <Kpi label="کاربران فعال" value={kpis.active.value} hint={`در ${toPersianDigits(days)} روز`} tint="var(--a-accent)" Icon={Activity} />
      </div>

      <div className="admTwo">
        <section className="admCard admChartCard">
          <div className="admChartHead">
            <h2>روند ثبت‌نام و رزرو</h2>
            <div className="admLegend">
              {SERIES.map((line) => (
                <span key={line.key}><svg width="26" height="8" aria-hidden="true"><line x1="1" x2="25" y1="4" y2="4" stroke={line.color} strokeWidth="3" strokeLinecap="round" strokeDasharray={line.dash} /></svg>{line.label}</span>
              ))}
              <Button size="sm" variant="ghost" onClick={() => setTableView((value) => !value)} aria-pressed={tableView}>{tableView ? "نمایش نمودار" : "نمایش جدول"}</Button>
            </div>
          </div>
          {tableView ? (
            <div className="admTableWrap">
              <table className="admTableView">
                <thead><tr><th>روز</th><th>ثبت‌نام</th><th>رزرو</th><th>پست</th></tr></thead>
                <tbody>
                  {series.map((row) => (
                    <tr key={row.day}><td>{dayLabel(row.day)}</td><td>{num(row.signups)}</td><td>{num(row.bookings)}</td><td>{num(row.posts)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <TrendChart series={series} />}
        </section>

        <section className="admCard">
          <h2>پیش‌بینی ۷ روز آینده</h2>
          <div className="admForecast">
            <div><small>ثبت‌نام جدید</small><b>≈ {num(forecast.signups)}</b></div>
            <div><small>رزرو جدید</small><b>≈ {num(forecast.bookings)}</b></div>
          </div>
          <p className="admMuted">برآورد ساده بر پایهٔ روند {toPersianDigits(forecast.basedOnDays)} روز اخیر{forecast.reliable ? "." : "؛ داده هنوز کم است و دقتش پایین است."}</p>
        </section>
      </div>

      <div className="admTwo">
        <section className="admCard">
          <h2>آخرین اتفاقات</h2>
          {data.feed.length ? (
            <ul className="admFeed">
              {data.feed.map((item, index) => {
                const meta = FEED[item.kind] || FEED.admin;
                const title = item.kind === "admin" ? ACTION_LABEL[item.title] || item.title : item.title;
                const detail = item.kind === "signup" ? TYPE_LABEL[item.detail] || item.detail : item.detail;
                return (
                  <li key={`${item.kind}-${index}-${item.at}`}>
                    <span className={`admFeedIcon is-${item.kind}`}><meta.Icon size={13} aria-hidden="true" /></span>
                    <span className="admFeedBody"><b>{meta.label}: {title}</b><small>{detail}</small></span>
                    <time dateTime={item.at}>{ago(item.at)}</time>
                  </li>
                );
              })}
            </ul>
          ) : <p className="admMuted">هنوز فعالیتی ثبت نشده.</p>}
        </section>
        <div className="admStack">
          <section className="admCard">
            <h2>کاربران بر اساس نوع</h2>
            <Bars rows={data.byType} labelOf={(row) => TYPE_LABEL[row.type] || row.type} colorOf={(row) => TYPE_COLOR[row.type] || "var(--a-faint)"} />
          </section>
          <section className="admCard">
            <h2>وضعیت رزروها (۳۰ روز)</h2>
            <Bars rows={data.statuses} labelOf={(row) => row.status} colorOf={() => "var(--a-accent)"} />
          </section>
        </div>
      </div>
    </div>
  );
}
