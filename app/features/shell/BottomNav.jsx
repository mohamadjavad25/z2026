"use client";

import { Plus } from "lucide-react";
import { PageIcon } from "../../components/PageIcon";

export function BottomNav({ activeTab, createdProfile, onTabChange, showCreateBooking = false, onCreateBooking }) {
  // Salon/artist owners already run their own business — browsing the
  // salon directory (a client-facing feature) isn't useful to them, so
  // their third tab opens their own customer community instead. See
  // SalonCustomersPage.
  const isBusinessOwner = createdProfile?.type === "salon" || createdProfile?.type === "artist";
  return (
    <nav className="bottomNav" aria-label="ناوبری موبایل">
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
            src={createdProfile?.data?.avatar || "/profile-icon.svg"}
            alt=""
            aria-hidden="true"
            style={{ objectPosition: createdProfile?.data?.avatarPosition || "50% 50%" }}
          />
        </button>
      )}
      {isBusinessOwner ? (
        <button type="button" onClick={() => onTabChange("customers")} className={activeTab === "customers" ? "active" : ""}>
          <PageIcon name="customers" size={24} />
          <span>مشتریان</span>
        </button>
      ) : (
        <button type="button" onClick={() => onTabChange("salons")} className={activeTab === "salons" ? "active" : ""}>
          <PageIcon name="discover" size={24} />
          <span>سالن</span>
        </button>
      )}
    </nav>
  );
}
