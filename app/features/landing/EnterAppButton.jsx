"use client";

import { useRouter } from "next/navigation";
import { ENTER_APP_EVENT, HOME_LANDING_SKIP_KEY } from "./constants";

/**
 * «ورود به فرفرو» on the about page (phones only, see landing.css). Remembers the choice so
 * "/" opens the app from now on, then shows the home page.
 */
export function EnterAppButton({ className, children }) {
  const router = useRouter();

  function enter(event) {
    event.preventDefault();
    try {
      localStorage.setItem(HOME_LANDING_SKIP_KEY, "1");
    } catch {}
    document.documentElement.classList.add("skip-landing");
    window.dispatchEvent(new Event(ENTER_APP_EVENT));
    window.scrollTo(0, 0);
    if (window.location.pathname !== "/") router.push("/");
  }

  return (
    <a href="/" className={className} onClick={enter}>
      {children}
    </a>
  );
}
