"use client";

import { useEffect, useRef } from "react";
import { playSound, unlockSounds } from "../../shared/lib/sounds";
import { toLatinDigits } from "../../shared/lib/digits";
import { AWAITING_CLIENT } from "../../shared/lib/bookingOffer";
import { resolveRollingPersianDate } from "../../shared/lib/persianCalendar";

const REMINDER_LEAD_MINUTES = 30;
const REMINDER_STORAGE_KEY = "frfro_reminded_bookings";
const ERROR_WORDS = /(نشد|خطا|مشکل|نامعتبر|اشغال|قطع)/;
const DONE_WORDS = /شد/;

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
 * confirmed / cancelled / expired, invites), for toasts, and the "appointment soon" alarm.
 * Nothing plays for the first data load after login, only for changes after that.
 * Booking sounds respect the "اعلان رزرو" setting.
 */
export function useAppSounds({
  profile,
  alertsOn = true,
  toast = "",
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
        if (!current.requests.has(id)) { playSound("request"); break; }
      }
    }
    current.requests = requestIds;

    const invites = new Set(inviteIds.map(String));
    if (current.invites) {
      for (const id of invites) {
        if (!current.invites.has(id)) { playSound("invite"); break; }
      }
    }
    current.invites = invites;

    const list = type === "client" ? clientBookings : type === "salon" ? salonBookings : type === "artist" ? artistBookings : [];
    const statuses = new Map(list.map((booking) => [bookingKey(booking), booking.status || ""]));
    if (current.statuses && alertsRef.current) {
      let sound = "";
      for (const [key, status] of statuses) {
        const before = current.statuses.get(key);
        if (before === undefined || before === status) continue;
        if (type === "client" && status === "تایید شده") sound = "confirmed";
        else if (type === "client" && status === AWAITING_CLIENT) sound = sound || "notify";
        else if (status === "لغو") sound = sound || "cancelled";
        else if (status === "منقضی شده") sound = sound || "expired";
      }
      if (sound) playSound(sound);
    }
    current.statuses = statuses;
  }, [identity, type, clientBookings, salonBookings, artistBookings, salonRequestIds, artistRequestIds, inviteIds]);

  // toasts: success / failure
  useEffect(() => {
    if (!toast) return;
    if (ERROR_WORDS.test(toast)) playSound("error");
    else if (DONE_WORDS.test(toast)) playSound("saved");
  }, [toast]);

  // appointment-soon alarm
  const bookingsForAlarm = type === "client" ? clientBookings : type === "salon" ? salonBookings : type === "artist" ? artistBookings : null;
  const alarmRef = useRef({ bookings: null, onReminder });
  alarmRef.current = { bookings: bookingsForAlarm, onReminder };
  useEffect(() => {
    if (!identity) return undefined;
    const check = () => {
      if (!alertsRef.current) return;
      const { bookings, onReminder: notify } = alarmRef.current;
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
          notify?.(`نوبت «${booking.service || "تو"}» تا ${Math.max(1, Math.round(minutes))} دقیقه دیگر است.`);
          break;
        }
      }
    };
    const timer = window.setInterval(check, 30000);
    check();
    return () => window.clearInterval(timer);
  }, [identity]);
}
