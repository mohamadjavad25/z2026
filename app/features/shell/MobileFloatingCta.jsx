"use client";

/**
 * Owner mobile floating dock (salon only) — renders the ProfileModeRail
 * ("خدمات/رزروها/پرسنل/پست‌ها" purple dock) above the global BottomNav.
 * Create-booking used to also float its own round "+" button here, but
 * that's now handled the same way artist's is — the global BottomNav's
 * profile-tab avatar swaps for a "+" button while already on the profile
 * page (see BottomNav.jsx's showCreateBooking prop) — so it doesn't need
 * a second, redundant entry point floating over the page content.
 */
export function MobileFloatingCta({
  open = false,
  profileType,
  modeRail = null
}) {
  if (!open || !profileType || !modeRail) return null;

  return (
    <div className="floatingMobileCta is-modeRail" aria-label="بخش‌های پروفایل موبایل">
      {modeRail}
    </div>
  );
}
