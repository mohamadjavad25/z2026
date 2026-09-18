"use client";

import { Check, Package, ReceiptText, RotateCcw, TimerOff, X } from "lucide-react";
import { shopOrderStatuses } from "../shops/mappers";
import { formatToman } from "../../shared/lib/money";
import { toPersianDigits } from "../../shared/lib/digits";

// The stepper only covers the "things are progressing" path — cancelled,
// returned and auto-expired orders each get their own distinct (non-stepped)
// state below instead of pretending they're just stuck on some step.
const TRACK_STEPS = shopOrderStatuses.filter((status) => status !== "لغو شده" && status !== "مرجوعی شد");

// Only the two terminal outcomes get a strong color — everything still in
// motion (new/preparing/shipped) reads as one calm "in progress" tone since
// the stepper below already carries the detail of exactly which step it's on.
// "منقضی شده" (shop never acknowledged the order within the 1-hour window —
// see bookingExpirySweep.js) deliberately gets its OWN tone, not "bad": it
// means "the shop never answered in time", not "the shop said no" (that's
// "لغو شده"), same distinction BookingCardBubble.jsx already makes.
const STATUS_TONE = {
  "تحویل شد": "done",
  "لغو شده": "bad",
  "مرجوعی شد": "bad",
  "منقضی شده": "expired"
};

/**
 * Neutral order receipt card. Always rendered as a centered system message
 * (never inside a normal left/right "is-me"/"is-them" chat bubble) — see
 * ChatPage.jsx, OwnerChatSheet.jsx and ShopStoreDock.jsx — precisely so it
 * cannot be mistaken for something either side of the conversation typed.
 * Content here is always a live snapshot from enrichOrderCards()/order-status
 * SSE, never a cached copy — do not add local state that could go stale.
 */
export function OrderCardBubble({ order }) {
  if (!order) {
    return (
      <div className="orderReceiptCard is-missing">
        <ReceiptText size={16} />
        <p>این سفارش دیگر در دسترس نیست.</p>
      </div>
    );
  }

  const items = order.items || [];
  const cancelled = order.status === "لغو شده";
  const returned = order.status === "مرجوعی شد";
  const expired = order.status === "منقضی شده";
  const stepIndex = TRACK_STEPS.indexOf(order.status);
  const tone = STATUS_TONE[order.status] || "pending";

  return (
    <div className="orderReceiptCard">
      <div className="orderReceiptCardHead">
        <span className="orderReceiptCardIcon">
          <ReceiptText size={15} />
        </span>
        <b>سفارش #{toPersianDigits(order.id)}</b>
        <span className={`orderReceiptCardStatus is-${tone}`}>{order.status}</span>
      </div>

      <ul className="orderReceiptCardItems">
        {items.map((item) => (
          <li key={item.id} className="orderReceiptCardItem">
            <span className="orderReceiptCardThumb">
              {item.image ? <img src={item.image} alt="" /> : <Package size={15} />}
            </span>
            <span className="orderReceiptCardItemInfo">
              <b>{item.name}</b>
              <small>{toPersianDigits(item.quantity)} عدد × {formatToman(item.priceNum || 0)}</small>
            </span>
          </li>
        ))}
      </ul>

      <div className="orderReceiptCardTotal">
        <span>جمع کل</span>
        <b>{formatToman(order.totalNum || 0)}</b>
      </div>

      {expired ? (
        <div className="orderReceiptCardExpired">
          <TimerOff size={13} />
          فروشگاه به‌موقع پاسخ نداد و سفارش به‌طور خودکار لغو شد
        </div>
      ) : cancelled || returned ? (
        <div className="orderReceiptCardCancelled">
          {cancelled ? <X size={13} /> : <RotateCcw size={13} />}
          {cancelled ? "سفارش لغو شده" : "سفارش مرجوعی شد"}
        </div>
      ) : (
        <div className="orderReceiptCardTrack" aria-label="مراحل سفارش">
          {TRACK_STEPS.map((status, index) => (
            <div
              key={status}
              className={`orderReceiptCardStep ${index <= stepIndex ? "is-done" : ""} ${index === stepIndex ? "is-current" : ""}`}
            >
              <span className="orderReceiptCardDot">{index < stepIndex ? <Check size={10} /> : null}</span>
              <small>{status}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
