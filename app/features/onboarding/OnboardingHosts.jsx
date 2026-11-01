"use client";

import { useEffect, useRef, useState } from "react";
import { useHome } from "../shell/HomeContext";
import { OnboardingSlides } from "./OnboardingSlides";
import { OPEN_TUTORIAL_EVENT, WELCOME_SEEN_KEY } from "./slides";
import { ENTER_APP_EVENT } from "../landing/constants";

function welcomeSeen() {
  try {
    return window.localStorage.getItem(WELCOME_SEEN_KEY) === "1";
  } catch {
    return true; // no storage (private mode): never show it on every open
  }
}

/**
 * The welcome, once per phone, before sign-up: over the role choice of the sign-up gate, never over the about page,
 * and not for a guest who came with a purpose (a salon's link to book or to join its team).
 */
export function WelcomeHost({ show }) {
  const { authChecked } = useHome();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // Only once the session check is over: a signed-in phone has no profile for a moment while it loads.
    if (!show || !authChecked) return undefined;
    const tryOpen = () => {
      if (welcomeSeen() || !document.documentElement.classList.contains("skip-landing")) return;
      if (/[?&](open|join)=/.test(window.location.search)) return;
      setOpen(true);
    };
    tryOpen();
    // On the about page: once the visitor taps «ورود به فرفرو».
    window.addEventListener(ENTER_APP_EVENT, tryOpen);
    return () => window.removeEventListener(ENTER_APP_EVENT, tryOpen);
  }, [show, authChecked]);
  useEffect(() => {
    if (!show) setOpen(false);
  }, [show]);
  if (!open) return null;
  return (
    <OnboardingSlides
      flow="welcome"
      onDone={() => {
        try { window.localStorage.setItem(WELCOME_SEEN_KEY, "1"); } catch { /* shows once more next time */ }
        setOpen(false);
      }}
    />
  );
}

/**
 * The tutorial of the signed-in role: by itself once after sign-up (the account's `tutorialPending`, set by the
 * server, cleared here at the end or on «رد شدن»; closed midway, it comes back next time), and from Settings any time.
 */
export function TutorialHost() {
  const { createdProfile, profileSettings, toggleProfileSetting, goToTab } = useHome();
  const role = ["client", "salon", "artist"].includes(createdProfile?.type) ? createdProfile.type : "";
  const pending = Boolean(profileSettings?.tutorialPending);
  const [open, setOpen] = useState(false);
  const endedFor = useRef(null);

  // A phone that has been signed in knows frfro: no welcome after a sign-out.
  useEffect(() => {
    try { window.localStorage.setItem(WELCOME_SEEN_KEY, "1"); } catch { /* the welcome may show once */ }
  }, []);

  useEffect(() => {
    if (!role || !pending || endedFor.current === createdProfile?.id) return undefined;
    // Never over the about page: once the app itself is showing.
    const tryOpen = () => {
      if (document.documentElement.classList.contains("skip-landing")) setOpen(true);
    };
    tryOpen();
    window.addEventListener(ENTER_APP_EVENT, tryOpen);
    return () => window.removeEventListener(ENTER_APP_EVENT, tryOpen);
  }, [role, pending, createdProfile?.id]);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_TUTORIAL_EVENT, show);
    return () => window.removeEventListener(OPEN_TUTORIAL_EVENT, show);
  }, []);

  if (!open || !role) return null;
  return (
    <OnboardingSlides
      flow={role}
      onDone={() => {
        endedFor.current = createdProfile?.id;
        setOpen(false);
        if (pending) toggleProfileSetting?.("tutorialPending");
        // Home: the client's bookings, the salon's and artist's «کامل کردن صفحه» steps.
        goToTab?.("profile");
      }}
    />
  );
}
