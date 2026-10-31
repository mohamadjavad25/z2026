"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toAsciiDigits, toPersianDigits } from "../../shared/lib/digits";
import { formatPersianDateKey } from "../../shared/lib/persianCalendar";
import { InstagramGlyph } from "../../components/InstagramFolder";
import { InstagramStorySheet, loadFreeSlots } from "./InstagramStorySheet";

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

/** "8:5" and "08:05" both become "08:05", the way free times are written. */
function clock(value) {
  const match = toAsciiDigits(String(value || "")).match(/(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : "";
}

/**
 * The one quiet story suggestion on an owner's home (owner's request 2026-10-31: no extra notifications, everything
 * smart and automatic but calm). It shows only while today or tomorrow has free times a client could still request,
 * says it in one line, and opens the story maker with a single tap. When a booking was just cancelled and its time is
 * free again, the line names that time instead. «امروز نه» hides it until tomorrow. It never sends a push and never
 * posts anything by itself.
 *
 * `cancelled`: bookings with status «لغو» ({ booking_date, time }); only used to name a freed time.
 */
export function StoryNudgeCard({ profile, cancelled = [], onNotify }) {
  const [slots, setSlots] = useState(null);
  const [hiddenDay, setHiddenDay] = useState("");
  const [open, setOpen] = useState(false);
  const type = profile?.type;
  const profileId = profile?.id;
  const today = formatPersianDateKey(new Date());

  useEffect(() => {
    setHiddenDay(readDismissedDay());
  }, []);

  useEffect(() => {
    if (!profileId || (type !== "salon" && type !== "artist")) return undefined;
    const key = `${type}:${profileId}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) {
      setSlots(hit.days);
      return undefined;
    }
    let cancelledLoad = false;
    loadFreeSlots(type, profileId)
      .then((days) => {
        cache.set(key, { at: Date.now(), days });
        if (!cancelledLoad) setSlots(days);
      })
      .catch(() => { if (!cancelledLoad) setSlots([]); });
    return () => { cancelledLoad = true; };
  }, [type, profileId]);

  if (!profileId || (type !== "salon" && type !== "artist")) return null;
  if (hiddenDay === today && !open) return null;
  const total = (slots || []).reduce((sum, day) => sum + day.times.length, 0);
  if (!total && !open) return null;

  // A cancelled booking whose time is free again, today or tomorrow.
  let freed = "";
  for (const day of slots || []) {
    const hit = (cancelled || []).find((booking) => (
      booking?.status === "لغو" && booking.booking_date === day.key && day.times.map(clock).includes(clock(booking.time))
    ));
    if (hit) { freed = clock(hit.time); break; }
  }

  const todayCount = (slots || []).find((day) => day.label === "امروز")?.times.length || 0;
  const title = freed
    ? `نوبت ساعت ${toPersianDigits(freed)} لغو شد و هنوز خالیه`
    : todayCount
      ? `امروز ${toPersianDigits(todayCount)} وقت خالی داری`
      : `فردا ${toPersianDigits(total)} وقت خالی داری`;
  const hint = freed ? "استوریش کن تا زود پر بشه." : "یه استوری آماده‌ست؛ یه لمس و می‌ره برای اینستاگرامت.";
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

  return (
    <>
      {hiddenDay === today ? null : (
        <section className={`storyNudge${freed ? " is-freed" : ""}`} aria-label="پیشنهاد استوری">
          <span className="storyNudgeIcon" aria-hidden="true"><InstagramGlyph size={20} /></span>
          <button type="button" className="storyNudgeMain" onClick={() => setOpen(true)}>
            <strong>{title}</strong>
            <small>{hint}</small>
          </button>
          <button type="button" className="storyNudgeNo" onClick={dismiss} aria-label="امروز نه">
            <X size={15} aria-hidden="true" />
          </button>
        </section>
      )}
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
