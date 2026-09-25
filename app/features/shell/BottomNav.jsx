"use client";

import { Plus, Settings, Store, Users } from "lucide-react";

export function BottomNav({ activeTab, createdProfile, onTabChange, showCreateBooking = false, onCreateBooking }) {
  // Salon owners already run a salon — browsing the salon directory (a
  // client-facing feature) isn't useful to them, so their third tab opens
  // their own customer community instead. See SalonCustomersPage.
  const isSalonOwner = createdProfile?.type === "salon";
  return (
    <nav className="bottomNav" aria-label="ناوبری موبایل">
      <button type="button" onClick={() => onTabChange("settings")} className={activeTab === "settings" ? "active" : ""}>
        <Settings size={20} />
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
          <img className="profileNavImage" src={createdProfile?.data?.avatar || "/profile-icon.svg"} alt="" aria-hidden="true" />
        </button>
      )}
      {isSalonOwner ? (
        <button type="button" onClick={() => onTabChange("customers")} className={activeTab === "customers" ? "active" : ""}>
          <Users size={20} />
          <span>مشتریان</span>
        </button>
      ) : (
        <button type="button" onClick={() => onTabChange("salons")} className={activeTab === "salons" ? "active" : ""}>
          <Store size={20} />
          <span>سالن</span>
        </button>
      )}
    </nav>
  );
}
