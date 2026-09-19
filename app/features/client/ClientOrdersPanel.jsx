"use client";

import { Clock3, Package, ReceiptText, RotateCcw } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatToman } from "../../shared/lib/money";
import { formatRequestExpiryDeadline } from "../../shared/lib/time";

function getStatusTone(status = "") {
  if (status === "تحویل شد") return "done";
  if (status === "لغو شده" || status === "مرجوعی شد") return "bad";
  // Shop never acknowledged the order within the 1-hour window — kept
  // distinct from "bad" (an active cancel/return) so the client can tell
  // "timed out" apart from "shop said no", same distinction already made
  // for bookings (see bookingExpirySweep.js / ClientBookingsPanel.jsx).
  if (status === "منقضی شده") return "expired";
  return "pending";
}

function formatOrderDate(rawDate) {
  if (!rawDate) return "";
  const date = new Date(rawDate.includes("T") ? rawDate : `${rawDate.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fa-IR", { month: "long", day: "numeric" });
}

function getOrderItemsSummary(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  if (!items.length) return "بدون اقلام";
  return items.map((item) => `${item.name || "محصول"} × ${toPersianDigits(item.quantity || 1)}`).join("، ");
}

/**
 * Client role — real purchase history (buyer side), fed by getMyShopOrders().
 * Presentational: orders + loading/loaded flags + "خرید دوباره" callback.
 * `loaded` (not just `loading`) drives the empty state so a fetch still in
 * flight never gets mislabeled as "no orders yet".
 */
export function ClientOrdersPanel({ orders = [], loaded = false, error = "", onBuyAgain }) {
  return (
    <section className="clientOrdersBoard" aria-label="خریدهای مشتری">
      <div className="boardHead">
        <div>
          <span>خریدهای من</span>
          <strong>سفارش‌های ثبت‌شده</strong>
        </div>
        <b>{toPersianDigits(orders.length)} سفارش</b>
      </div>

      {!loaded ? (
        <div className="clientOrdersLoading">
          <ReceiptText size={22} />
          <b>در حال بارگذاری سفارش‌ها…</b>
        </div>
      ) : orders.length ? (
        <div className="clientOrderList">
          {orders.map((order) => {
            const tone = getStatusTone(order.status);
            // Same "respond by HH:MM" touchpoint ClientBookingsPanel already
            // shows for a pending salon booking — an order sitting in "جدید"
            // is under the identical 1-hour unacknowledged-order policy (see
            // bookingExpirySweep.js), but until now this panel gave the buyer
            // no way to tell "جدید" apart from "this could take a while" —
            // just a neutral pending pill with no deadline or urgency cue.
            const pendingDeadline = order.status === "جدید"
              ? formatRequestExpiryDeadline(order.created_at)
              : "";
            return (
              <article className="clientOrderCard" key={order.id}>
                <div className="clientOrderCardTop">
                  <span className={`clientOrderLogo ${order.shop_avatar ? "hasImage" : ""}`} aria-hidden="true">
                    {order.shop_avatar ? <img src={order.shop_avatar} alt="" /> : <Package size={18} />}
                  </span>
                  <div className="clientOrderCardMeta">
                    <b>{order.shop_name || "فروشگاه"}</b>
                    <small>
                      سفارش #{toPersianDigits(order.id)}
                      {formatOrderDate(order.created_at) ? ` · ${formatOrderDate(order.created_at)}` : ""}
                    </small>
                  </div>
                  <span className={`clientOrderStatus is-${tone}`}>{order.status || "نامشخص"}</span>
                </div>
                <div className="clientOrderCardBody">
                  <span>{getOrderItemsSummary(order)}</span>
                  <b>{formatToman(order.total_num || 0)}</b>
                </div>
                {pendingDeadline ? (
                  <p className="clientBookingPendingNote">
                    <Clock3 size={14} />
                    در انتظار تایید فروشگاه — حداکثر تا ساعت {pendingDeadline}
                  </p>
                ) : null}
                <div className="clientOrderCardActions">
                  <button type="button" onClick={() => onBuyAgain?.(order)}>
                    <RotateCcw size={15} />
                    خرید دوباره
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : error ? (
        <div className="clientOrdersEmpty">
          <ReceiptText size={22} />
          <b>خریدها بارگذاری نشد</b>
          <span>{error}</span>
        </div>
      ) : (
        <div className="clientOrdersEmpty">
          <ReceiptText size={22} />
          <b>هنوز خریدی ثبت نشده</b>
          <span>بعد از خرید از فروشگاه‌ها، سفارش‌هات همین‌جا نمایش داده می‌شوند.</span>
        </div>
      )}
    </section>
  );
}
