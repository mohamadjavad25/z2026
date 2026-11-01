"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { formatPersianDateKey } from "../../shared/lib/persianCalendar";
import { InstagramGlyph } from "../../components/InstagramFolder";
import { InstagramStorySheet, loadFreeSlots } from "./InstagramStorySheet";
import { POSTED_EVENT, postedToday } from "./storyMemory";
import { buildSuggestion } from "./storySuggestion";

const DISMISS_KEY = "frfro-story-nudge-day";
const CACHE_MS = 5 * 60 * 1000;
// One read per page per few minutes, however often the home screen redraws.
const cache = new Map();

function readDismissedDay() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) || "";
  } catch {
    return "";
  }
}

/**
 * The calm story suggestion on an owner's home (owner's rules 2026-10-31 and 2026-11-01): «امروز ۳ وقت خالی داری»,
 * and a tap opens the story maker with frfro's suggested times, which the owner changes freely. It only suggests:
 * no push, no number on the bell, nothing about cancelled bookings. «×» hides it until tomorrow; a story made today
 * rests it for the rest of the day. It is one slide of the home's cards (HomeCards).
 */
export function StoryNudgeCard({ profile, onNotify }) {
  const [slots, setSlots] = useState(null);
  const [hiddenDay, setHiddenDay] = useState("");
  const [open, setOpen] = useState(false);
  const [posted, setPosted] = useState(false);
  const type = profile?.type;
  const profileId = profile?.id;
  const ownerKey = `${type}:${profileId}`;
  const today = formatPersianDateKey(new Date());

  useEffect(() => {
    setHiddenDay(readDismissedDay());
    setPosted(postedToday());
    const onPosted = () => setPosted(postedToday());
    window.addEventListener(POSTED_EVENT, onPosted);
    return () => window.removeEventListener(POSTED_EVENT, onPosted);
  }, [ownerKey]);

  useEffect(() => {
    if (!profileId || (type !== "salon" && type !== "artist")) return undefined;
    const hit = cache.get(ownerKey);
    if (hit && Date.now() - hit.at < CACHE_MS) {
      setSlots(hit.days);
      return undefined;
    }
    let cancelledLoad = false;
    loadFreeSlots(type, profileId)
      .then((days) => {
        cache.set(ownerKey, { at: Date.now(), days });
        if (!cancelledLoad) setSlots(days);
      })
      .catch(() => { if (!cancelledLoad) setSlots([]); });
    return () => { cancelledLoad = true; };
  }, [type, profileId, ownerKey]);

  if (!profileId || (type !== "salon" && type !== "artist")) return null;
  const suggestion = slots ? buildSuggestion({ days: slots, postedToday: posted, now: new Date() }) : null;
  const path = `/${type === "salon" ? "salons" : "artists"}/${Number(profileId)}`;
  const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, today);
    } catch {
      // Private mode: it only stays hidden until the page is opened again.
    }
    setHiddenDay(today);
  }

  const shown = suggestion && hiddenDay !== today;

  return (
    <>
      {shown ? (
        <section className="storyNudge" aria-label="پیشنهاد استوری">
          <span className="storyNudgeIcon" aria-hidden="true"><InstagramGlyph size={20} /></span>
          <button type="button" className="storyNudgeMain" onClick={() => setOpen(true)}>
            <strong>{suggestion.title}</strong>
            <small>یه استوری بذار، زودتر پر می‌شه.</small>
          </button>
          <button type="button" className="storyNudgeGo" onClick={() => setOpen(true)} tabIndex={-1} aria-hidden="true">بساز</button>
          <button type="button" className="storyNudgeNo" onClick={dismiss} aria-label="امروز نه">
            <X size={15} aria-hidden="true" />
          </button>
        </section>
      ) : null}
      <InstagramStorySheet
        open={open}
        name={profile?.data?.name || ""}
        avatar={profile?.data?.avatar || ""}
        profileType={type}
        profileId={profileId}
        url={url}
        onClose={() => setOpen(false)}
        onNotify={onNotify}
      />
    </>
  );
}
