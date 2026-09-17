"use client";

import { Check, Package, RotateCcw, X } from "lucide-react";
import { shopOrderStatuses } from "../shops/mappers";
import { formatToman } from "../../shared/lib/money";

// The stepper only covers the "things are progressing" path — cancelled and
// returned orders each get their own distinct (non-stepped) state below
// instead of pretending they're just stuck on some step.
const TRACK_STEPS = shopOrderStatuses.filter((status) => status !== "لغو شده" && status !== "مرجوعی شد");

/** Order receipt/tracking card rendered inside a chat bubble — same data on both the buyer's and the shop's side, always live (never a cached snapshot). */
export function OrderCardBubble({ order }) {
  if (!order) {
    return <p className="chatOrderCardMissing">این سفارش دیگر در دسترس نیست.</p>;
  }

  const items = order.items || [];
  const firstItem = items[0];
  const extraCount = items.length - 1;
  const cancelled = order.status === "لغو شده";
  const returned = order.status === "مرجوعی شد";
  const stepIndex = TRACK_STEPS.indexOf(order.status);

  return (
    <div className="chatOrderCard">
      <div className="chatOrderCardHead">
        <span className="chatOrderCardThumb">
          {firstItem?.image ? <img src={firstItem.image} alt="" /> : <Package size={18} />}
        </span>
        <div className="chatOrderCardInfo">
          <b>{firstItem?.name || "سفارش"}{extraCount > 0 ? ` + ${extraCount} کالای دیگر` : ""}</b>
          <span>{formatToman(order.totalNum || 0)}</span>
        </div>
      </div>

      {cancelled ? (
        <div className="chatOrderCardCancelled">
          <X size={13} />
          سفارش لغو شده
        </div>
      ) : returned ? (
        <div className="chatOrderCardCancelled">
          <RotateCcw size={13} />
          سفارش مرجوعی شد
        </div>
      ) : (
        <div className="chatOrderCardTrack" aria-label="مراحل سفارش">
          {TRACK_STEPS.map((status, index) => (
            <div key={status} className={`chatOrderCardStep ${index <= stepIndex ? "is-done" : ""} ${index === stepIndex ? "is-current" : ""}`}>
              <span className="chatOrderCardDot">{index < stepIndex ? <Check size={10} /> : null}</span>
              <small>{status}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
