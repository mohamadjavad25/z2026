"use client";

import { defaultAvatarFor } from "../../shared/lib/defaultAvatar";
import { Plus } from "lucide-react";
import { PageIcon } from "../../components/PageIcon";
import { toPersianDigits } from "../../shared/lib/digits";

// `status`: something that docks into the bar above the tabs (the client's booking status strip).
// `customersBadge`: how many new followers the owner has not looked at yet (shown on «مشتریان»).
export function BottomNav({ activeTab, createdProfile, onTabChange, showCreateBooking = false, onCreateBooking, status = null, customersBadge = 0 }) {
  // Salon/artist owners already run their own business — browsing the
  // salon directory (a client-facing feature) isn't useful to them, so
  // their third tab opens their own customer community instead. See
  // SalonCustomersPage. A client's third tab is where they start a booking.
  const isBusinessOwner = createdProfile?.type === "salon" || createdProfile?.type === "artist";
  return (
    <nav className="bottomNav" aria-label="ناوبری موبایل">
      {status}
      <button type="button" onClick={() => onTabChange("settings")} className={activeTab === "settings" ? "active" : ""}>
        <PageIcon name="settings" size={24} />
        <span>تنظیمات</span>
      </button>
      {showCreateBooking ? (
        <button
          type="button"
          onClick={onCreateBooking}
          className="profileTab is-createBooking"
          aria-label="ایجاد رزرو جدید"
        >
          <Plus size={26} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onTabChange("profile")}
          className={`profileTab ${activeTab === "profile" ? "active" : ""}`}
          aria-label="پروفایل"
        >
          <img
            className="profileNavImage"
            src={createdProfile?.data?.avatar || defaultAvatarFor(createdProfile?.type)}
            alt=""
            aria-hidden="true"
            style={{ objectPosition: createdProfile?.data?.avatarPosition || "50% 50%" }}
          />
        </button>
      )}
      {isBusinessOwner ? (
        <button
          type="button"
          onClick={() => onTabChange("customers")}
          className={activeTab === "customers" ? "active" : ""}
          aria-label={customersBadge > 0 ? `مشتریان؛ ${toPersianDigits(customersBadge)} مشتری تازه` : undefined}
        >
          <span className="bottomNavIcon">
            <PageIcon name="customers" size={24} />
            {customersBadge > 0 ? (
              <i className="bottomNavBadge" aria-hidden="true">{customersBadge > 9 ? "۹+" : toPersianDigits(customersBadge)}</i>
            ) : null}
          </span>
          <span>مشتریان</span>
        </button>
      ) : (
        <button type="button" onClick={() => onTabChange("salons")} className={activeTab === "salons" ? "active" : ""}>
          <PageIcon name="booking-add" size={24} />
          <span>رزرو</span>
        </button>
      )}
    </nav>
  );
}
