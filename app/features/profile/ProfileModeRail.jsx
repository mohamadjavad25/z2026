import { PageIcon } from "../../components/PageIcon";

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
  // Overview icon per role: storefront for a salon, posts for an artist's dock,
  // person for everyone else.
  const overviewIconName = profileType === "salon" ? "salon" : profileType === "artist" && placement === "dock" ? "posts" : "me";
  const overviewLabel = profileType === "artist" && placement === "panel" ? "من" : activeRoleMeta.overviewLabel;

  return (
    <div
      className={`profileModeRail ${placement === "dock" ? "is-dockRail" : "is-panelRail"} ${profileType === "client" ? "is-client" : ""} ${profileType === "artist" || profileType === "salon" ? "is-artist-rail" : ""} ${profileType === "salon" ? "is-salon" : ""}`}
      aria-label="بخش‌های پروفایل"
    >
      {profileType === "salon" && (
        <button type="button" className={salonWorkspace === "portfolio" ? "active" : ""} onClick={() => onSalonWorkspace("portfolio")}>
          <PageIcon name="posts" size={20} />
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
          <PageIcon name={overviewIconName} size={20} />
          {placement !== "dock" && <span>{overviewLabel}</span>}
        </button>
      )}

      {profileType === "salon" && (
        <>
          <button type="button" className={salonWorkspace === "staff" ? "active" : ""} onClick={() => onSalonWorkspace("staff")}>
            <PageIcon name="staff" size={20} />
            <span>پرسنل</span>
          </button>
          <button type="button" className={salonWorkspace === "hours" ? "active" : ""} onClick={() => onSalonWorkspace("hours")}>
            <PageIcon name="services" size={20} />
            <span>خدمات</span>
          </button>
        </>
      )}

      {profileType === "artist" && (
        <>
          <button type="button" className={profileView === "overview" ? "active" : ""} onClick={onOverview}>
            <PageIcon name="posts" size={20} />
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
            <PageIcon name="bookings" size={20} />
            <span>رزروها</span>
          </button>
          <button type="button" className={profileView === "services" ? "active" : ""} onClick={() => onProfileView("services")}>
            <PageIcon name="services" size={20} />
            <span>خدمات</span>
          </button>
          <button type="button" className={profileView === "collabs" ? "active" : ""} onClick={() => onProfileView("collabs")}>
            <PageIcon name="collab" size={20} />
            <span>همکاری</span>
          </button>
        </>
      )}
      {profileType === "client" && (
        <button type="button" className={profileView === "bookings" ? "active" : ""} onClick={() => onProfileView("bookings")}>
          <PageIcon name="activity" size={20} />
          <span>فعالیت من</span>
        </button>
      )}
    </div>
  );
}
