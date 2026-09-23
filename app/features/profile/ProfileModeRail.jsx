import { CalendarCheck, ImagePlus, Package, Settings, Store, Timer, UserRound } from "lucide-react";

export function ProfileModeRail({
  profileType,
  profileView,
  salonWorkspace,
  activeRoleMeta,
  onOverview,
  onSalonWorkspace,
  onProfileView,
  placement = "panel"
}) {
  const OverviewIcon = activeRoleMeta.overviewIcon;
  const DockOverviewIcon = profileType === "artist" && placement === "dock" ? ImagePlus : OverviewIcon;
  const overviewLabel = profileType === "artist" && placement === "panel" ? "من" : activeRoleMeta.overviewLabel;

  return (
    <div
      className={`profileModeRail ${placement === "dock" ? "is-dockRail" : "is-panelRail"} ${profileType === "shop" ? "is-compact" : ""} ${profileType === "client" ? "is-client" : ""} ${profileType === "artist" || profileType === "salon" ? "is-artist-rail" : ""} ${profileType === "salon" ? "is-salon" : ""}`}
      aria-label="بخش‌های پروفایل"
    >
      {profileType === "salon" && (
        <button type="button" className={salonWorkspace === "portfolio" ? "active" : ""} onClick={() => onSalonWorkspace("portfolio")}>
          <ImagePlus size={16} />
          <span>پست‌ها</span>
        </button>
      )}

      {!(profileType === "artist" && placement === "panel") && (
        <button
          type="button"
          className={profileView === "overview" && !salonWorkspace ? "active" : ""}
          onClick={onOverview}
          aria-label={overviewLabel}
        >
          <DockOverviewIcon size={16} />
          {placement !== "dock" && <span>{overviewLabel}</span>}
        </button>
      )}

      {profileType === "salon" && (
        <>
          <button type="button" className={salonWorkspace === "staff" ? "active" : ""} onClick={() => onSalonWorkspace("staff")}>
            <UserRound size={16} />
            <span>پرسنل</span>
          </button>
          <button type="button" className={salonWorkspace === "hours" ? "active" : ""} onClick={() => onSalonWorkspace("hours")}>
            <Timer size={16} />
            <span>خدمات</span>
          </button>
        </>
      )}

      {profileType === "artist" && (
        <>
          <button type="button" className={profileView === "overview" ? "active" : ""} onClick={onOverview}>
            <ImagePlus size={16} />
            <span>نمونه‌کار</span>
          </button>
          <button
            type="button"
            className={profileView === "bookings" ? "active" : ""}
            onClick={() => {
              onProfileView("bookings");
              // Deferred one frame: the view swap above is a React state
              // update, and scrolling in the same tick as that can get lost
              // on some mobile browsers if it lands before the new view's
              // layout actually commits.
              requestAnimationFrame(() => {
                window.scrollTo({ top: 0, behavior: "smooth" });
              });
            }}
          >
            <CalendarCheck size={16} />
            <span>رزروها</span>
          </button>
          <button type="button" className={profileView === "services" ? "active" : ""} onClick={() => onProfileView("services")}>
            <Timer size={16} />
            <span>خدمات</span>
          </button>
          <button type="button" className={profileView === "collabs" ? "active" : ""} onClick={() => onProfileView("collabs")}>
            <Store size={16} />
            <span>همکاری</span>
          </button>
        </>
      )}
      {profileType === "client" && (
        <button type="button" className={profileView === "bookings" ? "active" : ""} onClick={() => onProfileView("bookings")}>
          <CalendarCheck size={16} />
          <span>فعالیت من</span>
        </button>
      )}
      {profileType === "shop" && (
        <button type="button" className={profileView === "orders" ? "active" : ""} onClick={() => onProfileView("orders")}>
          <Package size={16} />
          <span>سفارش‌ها</span>
        </button>
      )}
      {profileType === "shop" && (
        <button type="button" className={profileView === "settings" ? "active" : ""} onClick={() => onProfileView("settings")}>
          <Settings size={16} />
          <span>تنظیمات</span>
        </button>
      )}
    </div>
  );
}
