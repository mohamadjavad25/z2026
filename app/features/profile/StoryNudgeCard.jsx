"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { formatPersianDateKey } from "../../shared/lib/persianCalendar";
import { InstagramGlyph } from "../../components/InstagramFolder";
import { InstagramStorySheet, loadFreeSlots } from "./InstagramStorySheet";
import { POSTED_EVENT, readPosted, readSeen, writeSeen } from "./storyMemory";
import { buildSuggestion, clock, formatLeft } from "./storySuggestion";

const DISMISS_KEY = "frfro-story-nudge-day";
const CACHE_MS = 5 * 60 * 1000;
// One read per page per few minutes, however often the home screen redraws.
const cache = new Map();
const NOT_ACTIVE = ["لغو", "منقضی شده", "رد شد", "رد"];

function readDismissedDay() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) || "";
  } catch {
    return "";
  }
}

/** The owner's upcoming bookings in one shape, whichever kind of owner they are. */
function activeBookings(type, bookings, today) {
  return (bookings || [])
    .filter((booking) => booking && booking.id != null && !NOT_ACTIVE.includes(booking.status))
    .map((booking) => ({
      id: String(booking.id),
      key: type === "salon" ? booking.booking_date : booking.dateKey,
      time: clock(booking.time),
      staff: type === "salon" ? String(booking.staff || "").trim() : ""
    }))
    .filter((booking) => booking.key && booking.time && booking.key >= today);
}

/**
 * The calm story suggestion on an owner's home (owner's request 2026-10-31: smart, automatic, no extra notifications).
 * What it says comes from buildSuggestion (storySuggestion.js): free times, a freed time with the hours left to it
 * and how much a story is still worth, or news since the story already made today. It never sends a push and never
 * posts by itself. «×» hides it until tomorrow. It is one slide of the home's cards (HomeCards).
 *
 * `bookings`: the owner's upcoming bookings (a salon's list also carries cancelled ones, marked «لغو»).
 */
export function StoryNudgeCard({ profile, bookings = [], onNotify }) {
  const [slots, setSlots] = useState(null);
  const [hiddenDay, setHiddenDay] = useState("");
  const [open, setOpen] = useState(false);
  const [posted, setPosted] = useState([]);
  // Read once, before anything is written back, so what vanished since the last look is still known.
  const [previous] = useState(() => (typeof window === "undefined" ? null : readSeen(`${profile?.type}:${profile?.id}`)));
  const type = profile?.type;
  const profileId = profile?.id;
  const ownerKey = `${type}:${profileId}`;
  const today = formatPersianDateKey(new Date());

  useEffect(() => {
    setHiddenDay(readDismissedDay());
    setPosted(readPosted());
    const onPosted = () => setPosted(readPosted());
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

  const current = useMemo(() => activeBookings(type, bookings, today), [type, bookings, today]);
  // Gone since the last look, and still ahead of us.
  const vanished = useMemo(
    () => (previous || []).filter((old) => old.key >= today && !current.some((now) => now.id === old.id)),
    [previous, current, today]
  );

  // Remember the list for the next look, keeping the vanished ones until their day has passed.
  useEffect(() => {
    if (previous === null && !current.length && !bookings.length) {
      writeSeen(ownerKey, []);
      return;
    }
    writeSeen(ownerKey, [...current, ...vanished]);
  }, [ownerKey, current, vanished, previous, bookings.length]);

  const suggestion = useMemo(
    () => (slots ? buildSuggestion({ days: slots, cancelled: type === "salon" ? bookings.map((b) => ({ ...b, booking_date: b.booking_date })) : [], vanished, posted, now: new Date() }) : null),
    [slots, type, bookings, vanished, posted]
  );

  if (!profileId || (type !== "salon" && type !== "artist")) return null;
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
  const hint = !suggestion ? "" : suggestion.kind === "freed" ? "هنوز خالیه؛ استوریش کن." : "یه استوری آماده‌ست؛ یه لمس و می‌ره برای اینستاگرامت.";
  const leftText = !suggestion ? "" : Number.isFinite(suggestion.left) && suggestion.left < 24 * 60 ? `${formatLeft(suggestion.left)} مونده` : "فردا";

  return (
    <>
      {shown ? (
        <section className={`storyNudge${suggestion.kind === "freed" ? " is-freed" : ""}`} aria-label="پیشنهاد استوری">
          <span className="storyNudgeIcon" aria-hidden="true"><InstagramGlyph size={20} /></span>
          <button type="button" className="storyNudgeMain" onClick={() => setOpen(true)}>
            <strong>{suggestion.title}</strong>
            <span className="storyNudgeRow">
              <em className={`storyNudgeLeft is-${suggestion.tone}`}>{leftText}</em>
              <small>{hint}</small>
            </span>
          </button>
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
