import { useEffect } from "react";

/**
 * /?team=1 opens where a team answer waits (2026-10-30): a salon's «پرسنل», an artist's «همکاری». Team notices link
 * here (TEAM_URL in app/lib/connectionNotify.js); before, they opened the home page and the owner could not find the
 * request. Runs once the account is known, then drops the parameter so a reload does not jump again.
 */
export function useTeamDeepLink({ profileType, goToTab, openSalonWorkspace, setProfileView }) {
  useEffect(() => {
    if (profileType !== "salon" && profileType !== "artist") return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("team")) return;
    goToTab?.("profile");
    if (profileType === "salon") openSalonWorkspace?.("staff");
    else setProfileView?.("collabs");
    params.delete("team");
    const rest = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`);
    // Only when the account type becomes known; the callbacks are not stable and must not re-run it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileType]);
}
