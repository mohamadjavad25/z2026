"use client";

import { Bell, MapPin, Search, Settings, Sparkles } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";

export function AppHeader({
  activeTab,
  createdProfile,
  salonUnreadNoticeCount,
  artistUnreadNoticeCount,
  onNoticeClick
}) {
  const noticeCount = createdProfile?.type === "salon"
    ? salonUnreadNoticeCount
    : createdProfile?.type === "artist"
      ? artistUnreadNoticeCount
      : 0;

  return (
    <header className={`appHeader ${!createdProfile || activeTab === "profile" ? "is-profile-hidden" : ""}`}>
      <div className="mobileBrand">
        <span><Sparkles size={20} /></span>
        زیبابان
      </div>
      <label className="globalSearch">
        <Search size={20} />
        <input placeholder="جستجوی مدل ناخن، رنگ مو، سالن یا سوال زیبایی..." />
      </label>
      <div className="locationPill"><MapPin size={17} /> تهران، جردن</div>
      <div className="headerActions">
        <button type="button" className="noticeBellButton" aria-label="اعلان‌ها" onClick={onNoticeClick}>
          <Bell size={19} />
          {noticeCount > 0 ? (
            <span>{toPersianDigits(noticeCount)}</span>
          ) : null}
        </button>
        <button type="button" aria-label="تنظیمات"><Settings size={19} /></button>
      </div>
    </header>
  );
}
