"use client";

import { ArchiveRestore, Check, CircleDollarSign, RotateCcw, Truck, X } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatToman } from "../../shared/lib/money";
import { PERSIAN_WEEKDAY_HEADERS } from "../../shared/lib/persianCalendar";
import { shopStockMovementReasons } from "./mappers";

function formatMovementDate(raw) {
  if (!raw) return "";
  const date = new Date(raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fa-IR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function orderTotal(order) {
  return Number(order?.totalNum) || 0;
}

function statusCount(orders, status) {
  return orders.filter((order) => order.status === status).length;
}

function parseOrderDate(order) {
  const raw = order?.createdAt || order?.created_at || "";
  if (!raw) return null;
  const iso = raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Last 7 calendar days (oldest→newest), each with its real order count. */
function buildWeeklyActivity(orders) {
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    days.push({ date: day, count: 0 });
  }
  orders.forEach((order) => {
    const date = parseOrderDate(order);
    if (!date) return;
    const day = new Date(date);
    day.setHours(0, 0, 0, 0);
    const bucket = days.find((entry) => entry.date.getTime() === day.getTime());
    if (bucket) bucket.count += 1;
  });
  return days.map((entry) => ({
    label: PERSIAN_WEEKDAY_HEADERS[(entry.date.getDay() + 1) % 7],
    count: entry.count
  }));
}

export function ShopInsightsPanel({
  orders = [],
  products = [],
  stockMovements = [],
  onOpenOrders
}) {
  const totalRevenue = orders.reduce((sum, order) => sum + orderTotal(order), 0);
  const averageOrder = orders.length ? Math.round(totalRevenue / orders.length) : 0;
  const deliveredCount = statusCount(orders, "تحویل شد");
  const conversionRate = orders.length ? Math.round((deliveredCount / orders.length) * 100) : 0;
  const lowStockCount = products.filter((p) => Number(p.stock || 0) > 0 && Number(p.stock || 0) <= 5).length;
  const outOfStockCount = products.filter((p) => Number(p.stock || 0) <= 0).length;

  const weeklyActivity = buildWeeklyActivity(orders);
  const hasWeeklyActivity = weeklyActivity.some((day) => day.count > 0);
  const maxDayCount = Math.max(1, ...weeklyActivity.map((day) => day.count));

  // In-progress steps (still moving toward a result) vs. an order's final
  // outcome — flattening all six into one grid buries "these are still
  // active" under "these are already resolved". Kept separate on screen too.
  const PIPELINE_STATUSES = ["جدید", "در حال آماده‌سازی", "ارسال شد"];
  const OUTCOME_STATUSES = [
    { status: "تحویل شد", icon: Check, tone: "done" },
    { status: "لغو شده", icon: X, tone: "cancel" },
    { status: "مرجوعی شد", icon: RotateCcw, tone: "return" }
  ];
  const pipelineSteps = PIPELINE_STATUSES.map((status) => ({ label: status, value: statusCount(orders, status) }));
  const outcomeSteps = OUTCOME_STATUSES.map(({ status, icon, tone }) => ({
    label: status,
    value: statusCount(orders, status),
    icon,
    tone
  }));
  const activeOrderCount = pipelineSteps.reduce((sum, step) => sum + step.value, 0);

  return (
    <div className="shopInsightsPage studioPage">
      <div className="studioRevenueHero">
        <span>خلاصه فروش</span>
        <strong className="studioNumeral">{totalRevenue ? formatToman(totalRevenue) : "بدون فروش ثبت‌شده"}</strong>
        <small>
          {orders.length
            ? `${toPersianDigits(orders.length)} سفارش، میانگین ${formatToman(averageOrder)}`
            : "با ثبت اولین سفارش، درآمد و رفتار خرید اینجا نمایش داده می‌شود."}
        </small>
      </div>

      <div className="studioLedger" aria-label="شاخص‌های مهم فروش">
        <div className="studioStat">
          <b className="studioNumeral">{toPersianDigits(orders.length)}</b>
          <span>تعداد سفارش</span>
        </div>
        <div className="studioStat">
          <b className="studioNumeral">{toPersianDigits(conversionRate)}٪</b>
          <span>نرخ تحویل</span>
        </div>
        <div className={`studioStat ${lowStockCount ? "is-alert" : ""}`}>
          <b className="studioNumeral">{toPersianDigits(lowStockCount)}</b>
          <span>کم‌موجودی</span>
        </div>
        <div className={`studioStat ${outOfStockCount ? "is-alert" : ""}`}>
          <b className="studioNumeral">{toPersianDigits(outOfStockCount)}</b>
          <span>ناموجود</span>
        </div>
      </div>

      <section className="studioSection" aria-label="فعالیت هفته">
        <div className="studioSectionHead">
          <h3>هفت روز اخیر</h3>
          <span className="studioEyebrow">{hasWeeklyActivity ? "تعداد سفارش روزانه" : "هنوز داده‌ی کافی نیست"}</span>
        </div>
        <div className="studioBars">
          {weeklyActivity.map((day, index) => (
            <span key={index}>
              <i
                className={day.count ? "" : "is-empty"}
                style={{ height: `${Math.round((day.count / maxDayCount) * 100) || 6}%` }}
              />
              <em>{toPersianDigits(day.count)}</em>
              <b>{day.label}</b>
            </span>
          ))}
        </div>
      </section>

      <section className="studioSection" aria-label="سفارش‌های در جریان">
        <div className="studioSectionHead">
          <h3>در جریان</h3>
          <span className="studioEyebrow">{toPersianDigits(activeOrderCount)} سفارش نیاز به اقدام</span>
        </div>
        <div className="studioPipelineRow">
          {pipelineSteps.map((step, index) => (
            <div className="studioPipelineStep" key={step.label}>
              <div className="studioPipelineStepBody">
                <b className="studioNumeral">{toPersianDigits(step.value)}</b>
                <span>{step.label}</span>
              </div>
              {index < pipelineSteps.length - 1 ? <span className="studioPipelineArrow" aria-hidden="true" /> : null}
            </div>
          ))}
        </div>
        <button type="button" className="studioLinkButton studioSectionLink" onClick={onOpenOrders}>
          مدیریت سفارش‌ها
          <Truck size={14} />
        </button>
      </section>

      <section className="studioSection" aria-label="نتیجه نهایی سفارش‌ها">
        <div className="studioSectionHead">
          <h3>نتیجه نهایی</h3>
        </div>
        <div className="studioOutcomeRow">
          {outcomeSteps.map(({ label, value, icon: Icon, tone }) => (
            <div className={`studioOutcomeChip is-${tone}`} key={label}>
              <Icon size={14} aria-hidden="true" />
              <b className="studioNumeral">{toPersianDigits(value)}</b>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      {stockMovements.length ? (
        <section className="studioSection" aria-label="تاریخچه انبار">
          <div className="studioSectionHead">
            <h3>تاریخچه انبار</h3>
            <span className="studioEyebrow">
              <ArchiveRestore size={13} />
              {toPersianDigits(stockMovements.length)} تغییر اخیر
            </span>
          </div>
          <div className="studioStockLedger">
            {stockMovements.slice(0, 8).map((entry) => (
              <div className="studioStockRow" key={entry.id}>
                <div className="studioStockRowMeta">
                  <strong>{entry.productName || "محصول حذف‌شده"}</strong>
                  <span>{shopStockMovementReasons[entry.reason] || entry.reason}</span>
                </div>
                <div className="studioStockRowEnd">
                  <b className={`studioNumeral ${entry.delta > 0 ? "is-positive" : "is-negative"}`}>
                    {entry.delta > 0 ? "+" : "−"}
                    {toPersianDigits(Math.abs(entry.delta))}
                  </b>
                  <small>{formatMovementDate(entry.createdAt)}</small>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {!orders.length && !products.length ? (
        <section className="studioEmpty" aria-label="راهنمای شروع">
          <CircleDollarSign size={22} />
          <b>گزارش‌ها بعد از اولین محصول و سفارش کامل می‌شوند</b>
          <span>محصول اضافه کن و اولین فروش رو ثبت کن تا آمار واقعی فروشگاهت اینجا شکل بگیره.</span>
        </section>
      ) : null}
    </div>
  );
}
