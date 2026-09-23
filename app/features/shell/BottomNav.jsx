"use client";

import { LayoutGrid, Store } from "lucide-react";

export function BottomNav({ activeTab, createdProfile, onTabChange }) {
  return (
    <nav className="bottomNav" aria-label="ناوبری موبایل">
      <button type="button" onClick={() => onTabChange("feed")} className={activeTab === "feed" ? "active" : ""}>
        <LayoutGrid size={20} />
        <span>اکسپلور</span>
      </button>
      <button
        type="button"
        onClick={() => onTabChange("profile")}
        className={`profileTab ${activeTab === "profile" ? "active" : ""}`}
        aria-label="پروفایل"
      >
        <img className="profileNavImage" src={createdProfile?.data?.avatar || "/profile-icon.svg"} alt="" aria-hidden="true" />
      </button>
      <button type="button" onClick={() => onTabChange("salons")} className={activeTab === "salons" ? "active" : ""}>
        <Store size={20} />
        <span>سالن</span>
      </button>
    </nav>
  );
}
