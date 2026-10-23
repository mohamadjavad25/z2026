"use client";

import { useEffect, useRef } from "react";
import { playSound, unlockSounds } from "../../shared/lib/sounds";
import { toLatinDigits } from "../../shared/lib/digits";
import { AWAITING_CLIENT } from "../../shared/lib/bookingOffer";
import { resolveRollingPersianDate } from "../../shared/lib/persianCalendar";
import { notify, onNotify } from "../../shared/notice/noticeStore";

const REMINDER_LEAD_MINUTES = 30;
const REMINDER_STORAGE_KEY = "frfro_reminded_bookings";

function bookingKey(booking) {
  return `${booking.bookingSource === "artist" ? "a" : "s"}${booking.id}`;
}

function startOfBooking(booking) {
  const raw = booking.booking_date || booking.date || booking.bookingDate || "";
  const match = toLatinDigits(String(booking.time || "")).match(/(\d{1,2}):(\d{2})/);
  if (!raw || !match) return null;
  const day = resolveRollingPersianDate(raw);
  day.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return day;
}

function readReminded() {
  try {
    return JSON.parse(window.localStorage.getItem(REMINDER_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function rememberReminded(key) {
  try {
    const next = [...readReminded().filter((item) => item !== key), key].slice(-200);
    window.localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // worst case the reminder repeats after a reload
  }
}

/**
 * Plays the app sounds for things that arrive on their own (new requests, a booking being
 * confirmed / cancelled / expired, invites), for notices, and the "appointment soon" alarm.
 * Each of those arrivals also shows a top notice (app/shared/notice). Nothing plays or shows
 * for the first data load after login, only for changes after that.
 * Booking sounds and notices respect the «خبرهای داخل اپ» setting (reservationAlerts).
 */
export function useAppSounds({
  profile,
  alertsOn = true,
  clientBookings = [],
  salonBookings = [],
  artistBookings = [],
  salonRequestIds = [],
  artistRequestIds = [],
  inviteIds = [],
  onReminder
}) {
  const type = profile?.type || "";
  const identity = profile?.id ? `${type}:${profile.id}` : "";
  const seen = useRef({ identity: "", requests: null, invites: null, statuses: null });
  const alertsRef = useRef(alertsOn);
  alertsRef.current = alertsOn;

  useEffect(() => { unlockSounds(); }, []);

  // new requests / invites / status changes
  useEffect(() => {
    if (!identity) return;
    const state = seen.current;
    if (state.identity !== identity) {
      seen.current = { identity, requests: null, invites: null, statuses: null };
    }
    const current = seen.current;

    const requestIds = new Set((type === "salon" ? salonRequestIds : artistRequestIds).map(String));
    if (current.requests && alertsRef.current) {
      for (const id of requestIds) {
        if (!current.requests.has(id)) {
          playSound("request");
          notify({ kind: "glass", tone: "info", title: "یه درخواست نوبت تازه!", text: "اعلان‌ها رو باز کن و جواب بده.", timer: 7000 });
          break;
        }
      }
    }
    current.requests = requestIds;

    const invites = new Set(inviteIds.map(String));
    if (current.invites) {
      for (const id of invites) {
        if (!current.invites.has(id)) {
          playSound("invite");
          notify({
            kind: "glass",
            tone: "info",
            title: "دعوت تازه",
            text: type === "salon" ? "یه درخواست همکاری تازه رسیده." : "یه سالن دعوتت کرده به تیمش.",
            timer: 7000
          });
          break;
        }
      }
    }
    current.invites = invites;

    const list = type === "client" ? clientBookings : type === "salon" ? salonBookings : type === "artist" ? artistBookings : [];
    const statuses = new Map(list.map((booking) => [bookingKey(booking), booking.status || ""]));
    if (current.statuses && alertsRef.current) {
      let sound = "";
      const confirmed = [];
      const byKey = new Map(list.map((booking) => [bookingKey(booking), booking]));
      for (const [key, status] of statuses) {
        const before = current.statuses.get(key);
        if (before === undefined || before === status) continue;
        if (type === "client" && status === "تایید شده") {
          sound = "confirmed";
          confirmed.push(byKey.get(key));
        }
        else if (type === "client" && status === AWAITING_CLIENT) sound = sound || "notify";
        else if (status === "لغو") sound = sound || "cancelled";
        else if (status === "منقضی شده") sound = sound || "expired";
      }
      if (sound) playSound(sound);
      const first = confirmed.find(Boolean);
      if (first) {
        notify({
          kind: "ticket",
          tone: "info",
          label: "نوبتت",
          big: first.time || "",
          title: "نوبتت تأیید شد!",
          text: [first.service, first.date].filter(Boolean).join(" · ")
        });
      }
    }
    current.statuses = statuses;
  }, [identity, type, clientBookings, salonBookings, artistBookings, salonRequestIds, artistRequestIds, inviteIds]);

  // notices: an error notice plays the error sound, a success notice the saved sound
  useEffect(() => onNotify((notice) => {
    if (notice.tone === "error") playSound("error");
    else if (notice.tone === "success") playSound("saved");
  }), []);

  // appointment-soon alarm
  const bookingsForAlarm = type === "client" ? clientBookings : type === "salon" ? salonBookings : type === "artist" ? artistBookings : null;
  const alarmRef = useRef({ bookings: null, onReminder });
  alarmRef.current = { bookings: bookingsForAlarm, onReminder };
  useEffect(() => {
    if (!identity) return undefined;
    const check = () => {
      if (!alertsRef.current) return;
      const { bookings, onReminder: remind } = alarmRef.current;
      if (!bookings) return;
      const now = Date.now();
      const reminded = readReminded();
      for (const booking of bookings) {
        if (booking.status !== "تایید شده") continue;
        const start = startOfBooking(booking);
        if (!start) continue;
        const minutes = (start.getTime() - now) / 60000;
        const key = bookingKey(booking);
        if (minutes > 0 && minutes <= REMINDER_LEAD_MINUTES && !reminded.includes(key)) {
          rememberReminded(key);
          playSound("alarm");
          const left = Math.max(1, Math.round(minutes));
          remind?.({
            kind: "ring",
            tone: "info",
            title: `نوبت «${booking.service || "تو"}» نزدیکه`,
            text: `${left} دقیقهٔ دیگه`,
            big: String(left),
            p: Math.max(4, Math.round((minutes / REMINDER_LEAD_MINUTES) * 100))
          });
          break;
        }
      }
    };
    const timer = window.setInterval(check, 30000);
    check();
    return () => window.clearInterval(timer);
  }, [identity]);
}
