import { BarChart3, Bell, Eye, MoreVertical, Settings, Share2 } from "lucide-react";

export function ProfileHeroActions({
  activePanel,
  profileType,
  onOpenSaved,
  onOpenNotifications,
  onOpenSettings,
  onShare,
  onPreviewPublic,
  notificationCount = 0,
  showShare = false
}) {
  const settingsActive = activePanel === "settings" || (profileType === "shop" && activePanel === "insights");
  const settingsLabel = profileType === "shop" ? "آمار و مالی فروشگاه" : "تنظیمات پروفایل";

  if (profileType === "salon") {
    return (
      <div className="profileHeroActions is-salonTopActions">
        <button
          type="button"
          className={`${activePanel === "notifications" ? "is-active" : ""} ${notificationCount > 0 ? "has-notifications" : ""}`.trim()}
          onClick={onOpenNotifications || onOpenSaved}
          aria-label="اعلان‌ها"
        >
          <Bell size={17} />
        </button>
        <button
          type="button"
          className={settingsActive ? "is-active" : ""}
          onClick={onOpenSettings}
          aria-label={settingsLabel}
        >
          <MoreVertical size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="profileHeroActions">
      <div className="profileHeroActionsGroup">
        <button
          type="button"
          className={settingsActive ? "is-active" : ""}
          onClick={onOpenSettings}
          aria-label={settingsLabel}
        >
          {profileType === "shop" ? <BarChart3 size={18} /> : <Settings size={17} />}
        </button>
        
      </div>
      <div className="profileHeroActionsGroup">
        {profileType === "artist" && (
          <button
            type="button"
            className={`${activePanel === "notifications" ? "is-active" : ""} ${notificationCount > 0 ? "has-notifications" : ""}`.trim()}
            onClick={onOpenNotifications}
            aria-label="اعلان‌ها"
          >
            <Bell size={17} />
          </button>
        )}
        {profileType === "artist" && (
          <button
            type="button"
            className="profileHeroPreviewBtn"
            onClick={onPreviewPublic}
            aria-label="پیش‌نمایش پروفایل عمومی"
            title="پیش‌نمایش پروفایل عمومی"
          >
            <Eye size={17} />
          </button>
        )}
        {showShare ? (
          <button type="button" aria-label="اشتراک‌گذاری" onClick={onShare}>
            <Share2 size={17} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
