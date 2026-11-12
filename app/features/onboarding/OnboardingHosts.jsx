"use client";

import { useEffect, useRef, useState } from "react";
import { useHome } from "../shell/HomeContext";
import { OnboardingSlides } from "./OnboardingSlides";
import { openSupport } from "../support";
import { OPEN_TUTORIAL_EVENT, WELCOME_SEEN_KEY } from "./slides";
import { ENTER_APP_EVENT } from "../landing/constants";
import { peekPendingOpen, peekPendingRequest } from "../../shared/lib/appHandoff";
import { apiFetch } from "../../shared/api/client";

/**
 * This visit came with a purpose: a salon's or artist's link to book (`?open=`, or the place a public page's
 * «رزرو» remembered), a salon's team link (`?join=`) or a client's request SMS link (`?request=`). Remembered for the visit, since the link is used up by sign-up.
 */
const PURPOSE_KEY = "frfro-came-with-purpose";
function cameWithPurpose() {
  try {
    if (/[?&](open|join|request)=/.test(window.location.search) || peekPendingOpen() || peekPendingRequest()) window.sessionStorage.setItem(PURPOSE_KEY, "1");
    return window.sessionStorage.getItem(PURPOSE_KEY) === "1";
  } catch {
    return false;
  }
}

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
  // Noted while the link is still there, so the tutorial after this sign-up waits too.
  useEffect(() => { cameWithPurpose(); }, []);
  useEffect(() => {
    // Only once the session check is over: a signed-in phone has no profile for a moment while it loads.
    if (!show || !authChecked) return undefined;
    const tryOpen = () => {
      if (welcomeSeen() || !document.documentElement.classList.contains("skip-landing")) return;
      if (cameWithPurpose()) return;
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
  const { createdProfile, profileSettings, toggleProfileSetting, arrivalIntent } = useHome();
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
    // Came to book or to join a team: that comes first; the tutorial waits for the next open of the app.
    if (cameWithPurpose() || arrivalIntent) return undefined;
    // Never over the about page: once the app itself is showing.
    const tryOpen = () => {
      if (document.documentElement.classList.contains("skip-landing")) setOpen(true);
    };
    tryOpen();
    window.addEventListener(ENTER_APP_EVENT, tryOpen);
    return () => window.removeEventListener(ENTER_APP_EVENT, tryOpen);
  }, [role, pending, createdProfile?.id, arrivalIntent]);

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
        // No move: a new account is already on its home (the «کامل کردن صفحه» steps of a salon or artist), and
        // a replay from Settings goes back to Settings.
      }}
    />
  );
}

const SURVEY_ENDED_KEY = "frfro-survey-ended";
function surveyEnded(id) {
  try {
    return window.localStorage.getItem(SURVEY_ENDED_KEY) === String(id);
  } catch {
    return false;
  }
}

/**
 * The come-back nudge (owner 2026-11-06): the server says whether it is this person's time, a moment after the app
 * opens (they have been away a few days, or tapped the push). It opens the «نظر و پیشنهاد» form in support, the same one
 * support always has. In the browser and in the Android app alike. Never over the tutorial, or over someone who came
 * to book or to join a team.
 */
export function SurveyHost() {
  const { createdProfile, profileSettings, arrivalIntent } = useHome();
  const id = createdProfile?.id;
  const pending = Boolean(profileSettings?.tutorialPending);
  const asked = useRef(null);

  useEffect(() => {
    if (!id || pending || arrivalIntent || asked.current === id || surveyEnded(id) || cameWithPurpose()) return undefined;
    let alive = true;
    let timer = null;
    const check = () => {
      if (asked.current === id || !document.documentElement.classList.contains("skip-landing")) return;
      asked.current = id;
      timer = window.setTimeout(async () => {
        const result = await apiFetch("/api/welcome-survey").catch(() => null);
        if (alive && result?.ok && result.payload?.data?.survey) openSupport({ view: "feedback", nudge: true });
      }, 2000);
    };
    check();
    window.addEventListener(ENTER_APP_EVENT, check);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      window.removeEventListener(ENTER_APP_EVENT, check);
      if (asked.current === id) asked.current = null;
    };
  }, [id, pending, arrivalIntent]);

  return null;
}
