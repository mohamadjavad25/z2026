"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, Image as ImageIcon, ShieldCheck, TriangleAlert, UserPlus } from "lucide-react";
import { apiFetch } from "../shared/api/client";
import { toPersianDigits } from "../shared/lib/digits";
import { Chip } from "../components/ui";
import { ACTION_LABEL, TYPE_LABEL, num } from "./format";

const SERIES = [
  { key: "signups", label: "ثبت‌نام", color: "#6b3fb0", dash: "" },
  { key: "bookings", label: "رزرو", color: "#e11d74", dash: "6 4" }
];

const dayLabel = (day) => new Intl.DateTimeFormat("fa-IR", { month: "short", day: "numeric", timeZone: "Asia/Tehran" }).format(new Date(`${day}T12:00:00+03:30`));

function ago(value) {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("fa", { numeric: "auto" });
  const abs = Math.abs(seconds);
  if (abs < 60) return "همین الان";
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  return rtf.format(Math.round(seconds / 86400), "day");
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

function Spark({ values, color }) {
  const max = Math.max(1, ...values);
  const points = values.map((value, index) => `${(index / Math.max(1, values.length - 1)) * 100},${28 - (value / max) * 24}`).join(" ");
  return (
    <svg className="admSpark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Kpi({ label, value, change, hint, values, color }) {
  return (
    <div className="admStat admKpi">
      <small>{label}</small>
      <b>{num(value)}</b>
      <div className="admKpiRow">
        {change === undefined ? null : <Delta change={change} />}
        {hint ? <em>{hint}</em> : null}
      </div>
      {values ? <Spark values={values} color={color} /> : null}
    </div>
  );
}

function LineChart({ series }) {
  const W = 640;
  const H = 220;
  const pad = { l: 34, r: 8, t: 12, b: 26 };
  const max = Math.max(1, ...series.flatMap((row) => SERIES.map((line) => row[line.key])));
  const x = (index) => pad.l + (series.length === 1 ? 0 : (index / (series.length - 1)) * (W - pad.l - pad.r));
  const y = (value) => pad.t + (1 - value / max) * (H - pad.t - pad.b);
  const ticks = [0, max / 2, max];
  const labelIdx = [0, Math.floor((series.length - 1) / 2), series.length - 1];
  const totals = SERIES.map((line) => `${line.label} ${series.reduce((sum, row) => sum + row[line.key], 0)}`).join("، ");
  return (
    <svg className="admChart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`روند ${series.length} روز گذشته؛ جمع: ${totals}`}>
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={pad.l} x2={W - pad.r} y1={y(tick)} y2={y(tick)} stroke="#e4e5ec" strokeWidth="1" />
          <text x={pad.l - 6} y={y(tick) + 4} textAnchor="end" fontSize="11" fill="#565a68">{toPersianDigits(Math.round(tick))}</text>
        </g>
      ))}
      {SERIES.map((line) => (
        <g key={line.key}>
          <polyline fill="none" stroke={line.color} strokeWidth="2.5" strokeDasharray={line.dash} strokeLinejoin="round" strokeLinecap="round" points={series.map((row, index) => `${x(index)},${y(row[line.key])}`).join(" ")} />
          {series.map((row, index) => (
            <circle key={row.day} cx={x(index)} cy={y(row[line.key])} r="3.5" fill="#fff" stroke={line.color} strokeWidth="2">
              <title>{`${dayLabel(row.day)} — ${line.label}: ${toPersianDigits(row[line.key])}`}</title>
            </circle>
          ))}
        </g>
      ))}
      {labelIdx.map((index) => (
        <text key={index} x={x(index)} y={H - 6} textAnchor="middle" fontSize="11" fill="#565a68">{dayLabel(series[index].day)}</text>
      ))}
    </svg>
  );
}

const FEED = {
  signup: { Icon: UserPlus, label: "ثبت‌نام جدید" },
  booking: { Icon: CalendarCheck, label: "رزرو جدید" },
  post: { Icon: ImageIcon, label: "پست جدید" },
  admin: { Icon: ShieldCheck, label: "عملیات مدیریتی" }
};

function Bars({ rows, labelOf }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  if (!rows.length) return <p className="admMuted">داده‌ای نیست.</p>;
  return (
    <ul className="admBarsH">
      {rows.map((row) => (
        <li key={row.type || row.status}>
          <span>{labelOf(row)}</span>
          <i style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }} aria-hidden="true" />
          <b>{num(row.count)}</b>
        </li>
      ))}
    </ul>
  );
}

/** The admin home: numbers vs the previous period, trend, things needing attention, recent activity and a simple 7-day forecast. */
export function Dashboard({ onGo }) {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

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

  if (failed) return <p className="admError" role="alert">بارگذاری داشبورد انجام نشد.</p>;
  if (!data) return <p className="admMuted">در حال بارگذاری…</p>;

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
    <>
      <div className="admToolbar">
        <div className="admChips" role="group" aria-label="بازهٔ زمانی">
          {[7, 30].map((value) => (
            <Chip key={value} selected={days === value} onClick={() => setDays(value)}>{toPersianDigits(value)} روز گذشته</Chip>
          ))}
        </div>
      </div>

      {attention.length ? (
        <section className="admCard admAttention" aria-label="نیازمند توجه">
          <h2><TriangleAlert size={18} aria-hidden="true" /> نیازمند توجه</h2>
          <ul>
            {attention.map((item) => (
              <li key={item.text}>
                <b>{num(item.n)}</b> {item.text}
                {item.go ? <button type="button" className="admLink" onClick={() => onGo(item.go)}>بررسی</button> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="admNote admOk" role="status">همه‌چیز عادی است؛ موردی نیازمند توجه نیست.</p>
      )}

      <div className="admGrid">
        <Kpi label="کل کاربران" value={totals.users} hint={`${num(kpis.signups.value)} جدید`} change={kpis.signups.change} values={col("signups")} color="#6b3fb0" />
        <Kpi label="رزروها" value={kpis.bookings.value} hint={`از ${num(totals.bookings)} کل`} change={kpis.bookings.change} values={col("bookings")} color="#e11d74" />
        <Kpi label="پست‌های جدید" value={kpis.posts.value} hint={`از ${num(totals.posts)} کل`} change={kpis.posts.change} values={col("posts")} color="#0f766e" />
        <Kpi label="کاربران فعال" value={kpis.active.value} hint={`در ${toPersianDigits(days)} روز`} />
      </div>

      <div className="admTwo">
        <section className="admCard">
          <h2>روند ثبت‌نام و رزرو</h2>
          <LineChart series={series} />
          <div className="admLegend" aria-hidden="true">
            {SERIES.map((line) => (
              <span key={line.key}><svg width="28" height="8" aria-hidden="true"><line x1="0" x2="28" y1="4" y2="4" stroke={line.color} strokeWidth="3" strokeDasharray={line.dash} /></svg> {line.label}</span>
            ))}
          </div>
        </section>
        <section className="admCard">
          <h2>پیش‌بینی ۷ روز آینده</h2>
          <ul className="admList">
            <li><span>ثبت‌نام جدید</span><b>≈ {num(forecast.signups)}</b></li>
            <li><span>رزرو جدید</span><b>≈ {num(forecast.bookings)}</b></li>
          </ul>
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
                    <span className={`admFeedIcon is-${item.kind}`}><meta.Icon size={16} aria-hidden="true" /></span>
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
            <Bars rows={data.byType} labelOf={(row) => TYPE_LABEL[row.type] || row.type} />
          </section>
          <section className="admCard">
            <h2>وضعیت رزروها (۳۰ روز)</h2>
            <Bars rows={data.statuses} labelOf={(row) => row.status} />
          </section>
        </div>
      </div>
    </>
  );
}
