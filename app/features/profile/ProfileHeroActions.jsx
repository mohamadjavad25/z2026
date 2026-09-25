import { Bell, Eye, Share2 } from "lucide-react";

// The gear/settings icon that used to live here was removed: "تنظیمات" is
// now its own bottom-nav tab (see SettingsPage), so a second entry point
// floating on top of the profile poster was pure duplication.
export function ProfileHeroActions({
  activePanel,
  profileType,
  onOpenSaved,
  onOpenNotifications,
  onShare,
  onPreviewPublic,
  notificationCount = 0,
  showShare = false
}) {
  if (profileType === "salon") {
    return (
      <div className="profileHeroActions is-salonTopActions">
        <button
          type="button"
          className={`${activePanel === "notifications" ? "is-active" : ""} ${notificationCount > 0 ? "has-notifications" : ""}`.trim()}
          onClick={onOpenNotifications}
          disabled={typeof onOpenNotifications !== "function"}
          aria-label="اعلان‌ها"
        >
          <Bell size={17} />
        </button>
      </div>
    );
  }

  return (
    <div className="profileHeroActions">
      <div className="profileHeroActionsGroup">
        {(profileType === "artist" || profileType === "client") && (
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
