"use client";

/** Seven small day marks: the days a member works are filled, today has a ring. `large` is the member page's size. */
export function WeekStrip({ week, large = false }) {
  return (
    <div className={`twWeek${large ? " is-large" : ""}`} role="img" aria-label={week.filter((item) => item.on).map((item) => item.day).join("، ") || "روزهای کارش مشخص نیست"}>
      {week.map((item) => (
        <i key={item.day} className={`${item.on ? "is-on" : "is-off"}${item.today ? " is-today" : ""}`} aria-hidden="true">{item.letter}</i>
      ))}
    </div>
  );
}
