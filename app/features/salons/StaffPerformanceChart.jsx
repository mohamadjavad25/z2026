"use client";

import { useState } from "react";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatTomanNumber } from "../../shared/lib/money";

const MODES = [
  { id: "income", label: "درآمد" },
  { id: "bookings", label: "رزرو" }
];

function compactToman(value) {
  if (value >= 1_000_000) return `${toPersianDigits((value / 1_000_000).toFixed(1).replace(/\.0$/, ""))}م`;
  if (value >= 1_000) return `${toPersianDigits(Math.round(value / 1_000))}ه`;
  return toPersianDigits(value);
}

function weekLabel(weeksAgo) {
  if (weeksAgo === 0) return "این هفته";
  if (weeksAgo === 1) return "هفته قبل";
  return `${toPersianDigits(weeksAgo)} هفته پیش`;
}

/** Weekly income / bookings bars + KPI strip for one artist (see staffStats.js). */
export function StaffPerformanceChart({ stats }) {
  const [mode, setMode] = useState("income");
  if (!stats) return null;

  const values = stats.weeks.map((week) => (mode === "income" ? week.income : week.bookings));
  const max = Math.max(...values, 0);
  const topCount = stats.topServices[0]?.count || 1;

  return (
    <section className="staffProfileSection staffPerf" aria-label="عملکرد آرتیست">
      <div className="staffProfileSectionHead">
        <span>عملکرد ۶ هفته اخیر</span>
        <small>بر اساس رزروهای ثبت‌شده در سالن</small>
      </div>

      <div className="staffPerfKpis">
        <article>
          <b>{formatTomanNumber(stats.income)}</b>
          <small>درآمد (تومان)</small>
        </article>
        <article>
          <b>{toPersianDigits(stats.completed)}</b>
          <small>رزرو انجام‌شده</small>
        </article>
        <article>
          <b>{toPersianDigits(stats.upcoming)}</b>
          <small>رزرو پیش‌رو</small>
        </article>
      </div>

      <div className="staffPerfCard">
        <div className="staffPerfTabs" role="tablist" aria-label="نوع نمودار">
          {MODES.map((item) => (
            <button
              type="button"
              role="tab"
              key={item.id}
              aria-selected={mode === item.id}
              className={mode === item.id ? "active" : ""}
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {max === 0 ? (
          <p className="staffPerfEmpty">هنوز رزرو ثبت‌شده‌ای در این بازه نیست.</p>
        ) : (
          <div className="staffPerfBars" role="img" aria-label={`نمودار ${mode === "income" ? "درآمد" : "رزرو"} هفتگی`}>
            {stats.weeks.map((week, index) => {
              const value = values[index];
              const weeksAgo = stats.weeks.length - 1 - index;
              return (
                <div className={`staffPerfBar ${weeksAgo === 0 ? "is-current" : ""}`} key={index}>
                  <em>{value ? (mode === "income" ? compactToman(value) : toPersianDigits(value)) : ""}</em>
                  <span className="staffPerfBarTrack">
                    <i style={{ height: `${value ? Math.max(6, (value / max) * 100) : 0}%` }} />
                  </span>
                  <small>{weekLabel(weeksAgo)}</small>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {stats.topServices.length ? (
        <div className="staffPerfServices">
          <div className="staffPerfServicesHead">
            <span>پرطرفدارترین خدمات</span>
            {stats.cancelRate ? <small>{toPersianDigits(stats.cancelRate)}٪ لغو</small> : null}
          </div>
          {stats.topServices.map((service) => (
            <div className="staffPerfService" key={service.name}>
              <b>{service.name}</b>
              <span className="staffPerfServiceTrack"><i style={{ width: `${(service.count / topCount) * 100}%` }} /></span>
              <small>{toPersianDigits(service.count)}</small>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
