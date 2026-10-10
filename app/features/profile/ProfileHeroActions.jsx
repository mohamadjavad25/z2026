import { Bell, QrCode, Share2 } from "lucide-react";

// The gear/settings icon that used to live here was removed: "تنظیمات" is
// now its own bottom-nav tab (see SettingsPage), so a second entry point
// floating on top of the profile poster was pure duplication.
export function ProfileHeroActions({
  activePanel,
  profileType,
  onOpenSaved,
  onOpenNotifications,
  onShare,
  onShowQr,
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
        {/* QR first: in RTL it lands on the right and the bell on the left, as on the salon hero. */}
        {typeof onShowQr === "function" ? (
          <button type="button" onClick={onShowQr} aria-label="کد QR و اسکن" title="کد QR و اسکن">
            <QrCode size={17} />
          </button>
        ) : null}
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
        {showShare ? (
          <button type="button" aria-label="اشتراک‌گذاری" onClick={onShare}>
            <Share2 size={17} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
