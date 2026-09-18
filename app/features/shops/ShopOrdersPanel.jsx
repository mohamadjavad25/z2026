"use client";

import { useMemo, useState } from "react";
import { ArchiveRestore, ReceiptText, ShieldCheck, Truck } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatToman } from "../../shared/lib/money";
import { shopOrderStatuses } from "./mappers";

const ORDER_FILTERS = ["همه", ...shopOrderStatuses];

/** The single next forward step for each status, or null when terminal. */
const NEXT_STATUS = {
  "جدید": "در حال آماده‌سازی",
  "در حال آماده‌سازی": "ارسال شد",
  "ارسال شد": "تحویل شد"
};

const NEXT_STATUS_LABEL = {
  "جدید": "شروع آماده‌سازی",
  "در حال آماده‌سازی": "ثبت ارسال",
  "ارسال شد": "ثبت تحویل"
};

function getOrderItemsText(order) {
  if (Array.isArray(order?.items) && order.items.length) {
    return order.items.map((item) => `${item.name || "محصول"} × ${toPersianDigits(item.quantity || 1)}`).join("، ");
  }
  return "بدون اقلام";
}

function getStatusTone(status = "") {
  if (status === "جدید") return "new";
  if (status === "در حال آماده‌سازی") return "prep";
  if (status === "ارسال شد") return "ship";
  if (status === "تحویل شد") return "done";
  if (status === "لغو شده") return "cancel";
  if (status === "مرجوعی شد") return "return";
  // Auto-expired by the 1-hour unacknowledged-order sweep (bookingExpirySweep.js)
  // — deliberately its own tone, not "cancel": this tells the shop owner "I let
  // this one time out" apart from "I cancelled this one myself", same
  // distinction already made for artist bookings (bookingUtils.getArtistBookingStatusKey).
  // NOT in shopOrderStatuses/ORDER_FILTERS above (a shop can never set this
  // status manually — see SHOP_ORDER_STATUSES in shops.js repo), so it only
  // ever shows up here via a real order that actually expired.
  if (status === "منقضی شده") return "expired";
  return "new";
}

function formatOrderDate(order) {
  const raw = order?.createdAt || "";
  if (!raw) return "";
  const date = new Date(raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fa-IR", { month: "long", day: "numeric" });
}

/**
 * Shop owner — orders management tab. Real orders only; status changes
 * persist through changeShopOrderStatus (PATCH /api/shop/orders).
 */
export function ShopOrdersPanel({ orders = [], busyOrderId = null, onChangeStatus }) {
  const [statusFilter, setStatusFilter] = useState("همه");

  const filterCounts = useMemo(() => {
    const counts = { "همه": orders.length };
    shopOrderStatuses.forEach((status) => {
      counts[status] = orders.filter((order) => order.status === status).length;
    });
    return counts;
  }, [orders]);

  const activeCount = (filterCounts["جدید"] || 0) + (filterCounts["در حال آماده‌سازی"] || 0) + (filterCounts["ارسال شد"] || 0);

  const filteredOrders = useMemo(() => {
    if (statusFilter === "همه") return orders;
    return orders.filter((order) => order.status === statusFilter);
  }, [orders, statusFilter]);

  return (
    <div className="shopOrdersPage studioPage">
      <div className="studioRevenueHero">
        <span>سفارش‌های فروشگاه</span>
        <strong className="studioNumeral">{toPersianDigits(orders.length)}</strong>
        <small>{activeCount ? `${toPersianDigits(activeCount)} سفارش در انتظار اقدام` : "همه سفارش‌ها رسیدگی شده‌اند"}</small>
      </div>

      <div className="studioTabs" role="tablist" aria-label="فیلتر وضعیت سفارش">
        {ORDER_FILTERS.map((status) => (
          <button
            type="button"
            key={status}
            role="tab"
            aria-selected={statusFilter === status}
            className={statusFilter === status ? "active" : ""}
            onClick={() => setStatusFilter(status)}
          >
            {status}
            <b>{toPersianDigits(filterCounts[status] || 0)}</b>
          </button>
        ))}
      </div>

      <div className="studioSection">
        {filteredOrders.length === 0 ? (
          <div className="studioEmpty">
            <ReceiptText size={22} />
            <b>
              {orders.length === 0
                ? "هنوز سفارشی ثبت نشده است"
                : `سفارشی با وضعیت «${statusFilter}» نیست.`}
            </b>
            <span>سفارش‌های مشتریان همین‌جا با مبلغ، وضعیت و اقدام بعدی نمایش داده می‌شوند.</span>
          </div>
        ) : (
          <div>
            {filteredOrders.map((order) => {
              const nextStatus = NEXT_STATUS[order.status];
              const busy = busyOrderId === order.id;
              return (
                <article className="studioOrderCard" key={order.id}>
                  <div className="studioOrderCardTop">
                    <span className="studioOrderAvatar" aria-hidden="true">{order.buyerName?.[0] || "م"}</span>
                    <div className="studioOrderCardMeta">
                      <strong>{order.buyerName}</strong>
                      <span>سفارش #{toPersianDigits(order.id)}{formatOrderDate(order) ? ` · ${formatOrderDate(order)}` : ""}</span>
                    </div>
                    <span className={`studioTag is-${getStatusTone(order.status)}`}>{order.status}</span>
                  </div>
                  <div className="studioOrderCardBody">
                    <span>{getOrderItemsText(order)}</span>
                    <strong className="studioNumeral">{formatToman(order.totalNum)}</strong>
                  </div>
                  <div className="studioOrderCardActions">
                    {nextStatus ? (
                      <button
                        type="button"
                        className="studioLinkButton"
                        disabled={busy}
                        onClick={() => onChangeStatus?.(order.id, nextStatus)}
                      >
                        {nextStatus === "تحویل شد" ? <ShieldCheck size={14} /> : <Truck size={14} />}
                        {NEXT_STATUS_LABEL[order.status]}
                      </button>
                    ) : null}
                    {order.status !== "لغو شده" && order.status !== "تحویل شد" && order.status !== "مرجوعی شد" && order.status !== "منقضی شده" ? (
                      <button
                        type="button"
                        className="studioLinkButton is-muted"
                        disabled={busy}
                        onClick={() => onChangeStatus?.(order.id, "لغو شده")}
                      >
                        لغو سفارش
                      </button>
                    ) : null}
                    {order.status === "تحویل شد" ? (
                      <button
                        type="button"
                        className="studioLinkButton is-muted"
                        disabled={busy}
                        onClick={() => onChangeStatus?.(order.id, "مرجوعی شد")}
                      >
                        <ArchiveRestore size={14} />
                        ثبت مرجوعی
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
