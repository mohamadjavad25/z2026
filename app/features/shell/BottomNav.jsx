"use client";

import { LayoutGrid, Plus, Store } from "lucide-react";

export function BottomNav({ activeTab, createdProfile, onTabChange, showCreateBooking = false, onCreateBooking }) {
  return (
    <nav className="bottomNav" aria-label="ناوبری موبایل">
      <button type="button" onClick={() => onTabChange("feed")} className={activeTab === "feed" ? "active" : ""}>
        <LayoutGrid size={20} />
        <span>اکسپلور</span>
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
      <button type="button" onClick={() => onTabChange("salons")} className={activeTab === "salons" ? "active" : ""}>
        <Store size={20} />
        <span>سالن</span>
      </button>
    </nav>
  );
}
