"use client";

import { MessageCircle, Plus } from "lucide-react";
import { BookingCtaSegment } from "../profile/BookingCtaSegment";

/**
 * Owner mobile floating CTA (shop / salon / artist / client).
 * Presentational: open flags + callbacks owned by HomeApp.
 * Salon/artist use modeRail (ProfileModeRail) in the purple dock.
 */
export function MobileFloatingCta({
  open = false,
  profileType,
  sheetOpen = false,
  shopProductCount = 0,
  shopUnreadCount = 0,
  bookingSheetOpen = false,
  modeRail = null,
  onCreateProduct,
  onOpenShopChat,
  onToggleBooking,
  onOpenClientChat
}) {
  if (!open || !profileType) return null;
  if (profileType === "artist") return null;

  if (modeRail) {
    return (
      <div className="floatingMobileCta is-modeRail" aria-label="بخش‌های پروفایل موبایل">
        {modeRail}
      </div>
    );
  }

  return (
    <div
      className={`floatingMobileCta floatingMobileCtaSplit ${sheetOpen ? "is-open" : ""} ${profileType === "shop" ? "is-shopCta" : ""}`}
      aria-label="اقدام سریع موبایل"
    >
      {profileType === "shop" ? (
        <>
          <button type="button" className="ctaSegment ctaGenerate" onClick={onCreateProduct}>
            <span className="ctaIcon"><Plus size={18} /></span>
            <span className="ctaText">
              <b>ایجاد محصول</b>
              <small>{shopProductCount} آیتم در ویترین</small>
            </span>
          </button>
          <button type="button" className="ctaSegment ctaManage" onClick={onOpenShopChat}>
            <span className="ctaIcon"><MessageCircle size={18} /></span>
            <span className="ctaText">
              <b>چت</b>
              <small>{shopUnreadCount} پیام جدید</small>
            </span>
          </button>
        </>
      ) : (
        <>
          {(profileType === "salon" || profileType === "artist") ? (
            <BookingCtaSegment
              title="ایجاد رزرو"
              hint="نوبت جدید برای مشتری"
              active={bookingSheetOpen}
              onClick={onToggleBooking}
            />
          ) : (
            <button type="button" className="ctaSegment ctaManage" onClick={onOpenClientChat}>
              <span className="ctaIcon"><MessageCircle size={18} /></span>
              <span className="ctaText">
                <b>چت</b>
                <small>پیام‌های تو</small>
              </span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
