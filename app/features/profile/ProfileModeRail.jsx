import { PageIcon } from "../../components/PageIcon";
import { toPersianDigits } from "../../shared/lib/digits";

/**
 * The tab row under a salon's or artist's profile header. Both roles get the same names in the same
 * order, and both open on «نوبت‌ها» (user's choice 2026-10-23):
 *   salon:  نوبت‌ها (overview: the schedule) · خدمات · نمونه‌کار · پرسنل
 *   artist: نوبت‌ها (overview: the schedule) · خدمات · نمونه‌کار · همکاری
 * A client's page has no tab row (ClientHome). `badges` puts a count on a tab ({ staff, collabs }): artists asking to
 * join the salon, or salons inviting the artist, so the owner sees where the answer waits (2026-10-30).
 */
export function ProfileModeRail({
  profileType,
  profileView,
  salonWorkspace,
  onOverview,
  onSalonWorkspace,
  onProfileView,
  badges = {},
  placement = "panel"
}) {
  const salon = profileType === "salon";
  const tabs = salon
    ? [
        { id: "overview", label: "نوبت‌ها", icon: "bookings", on: profileView === "overview" && !salonWorkspace, go: onOverview },
        { id: "hours", label: "خدمات", icon: "services", on: salonWorkspace === "hours", go: () => onSalonWorkspace("hours") },
        { id: "portfolio", label: "نمونه‌کار", icon: "posts", on: salonWorkspace === "portfolio", go: () => onSalonWorkspace("portfolio") },
        { id: "staff", label: "پرسنل", icon: "staff", on: salonWorkspace === "staff", go: () => onSalonWorkspace("staff") }
      ]
    : profileType === "artist"
      ? [
          { id: "overview", label: "نوبت‌ها", icon: "bookings", on: profileView === "overview" || profileView === "bookings", go: onOverview },
          { id: "services", label: "خدمات", icon: "services", on: profileView === "services", go: () => onProfileView("services") },
          { id: "portfolio", label: "نمونه‌کار", icon: "posts", on: profileView === "portfolio", go: () => onProfileView("portfolio") },
          { id: "collabs", label: "همکاری", icon: "collab", on: profileView === "collabs", go: () => onProfileView("collabs") }
        ]
      : [];

  return (
    <div
      className={`profileModeRail ${placement === "dock" ? "is-dockRail" : "is-panelRail"} is-artist-rail${salon ? " is-salon" : ""}`}
      aria-label="بخش‌های پروفایل"
    >
      {tabs.map((tab) => (
        <button
          type="button"
          key={tab.id}
          className={`is-tab-${tab.id}${tab.on ? " active" : ""}`}
          aria-current={tab.on ? "page" : undefined}
          onClick={() => {
            tab.go();
            // Deferred one frame: the view swap is a React state update, and scrolling in the same
            // tick can get lost on some mobile browsers before the new view's layout commits.
            requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
          }}
        >
          <PageIcon name={tab.icon} size={20} />
          <span>{tab.label}</span>
          {badges[tab.id] > 0 ? <em className="pmrBadge" aria-label={`${toPersianDigits(badges[tab.id])} تازه`}>{toPersianDigits(badges[tab.id])}</em> : null}
        </button>
      ))}
    </div>
  );
}
