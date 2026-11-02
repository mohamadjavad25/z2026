import { useEffect, useRef } from "react";
import { toLatinDigits } from "./digits.js";

/**
 * The phone's contact picker: the frfro Android app's own (ContactPickerPlugin in mobile/), else
 * Chrome on Android's. Both show the system's own list, so frfro only ever sees the one contact the
 * person picks. Elsewhere (iPhone, desktop) it doesn't exist.
 */
function nativeApp() {
  if (typeof window === "undefined") return null;
  const cap = window.Capacitor;
  return cap?.isNativePlatform?.() ? cap : null;
}

function nativeContactPicker() {
  const cap = nativeApp();
  const has = cap
    && typeof cap.nativePromise === "function"
    && (cap.PluginHeaders || []).some((plugin) => plugin?.name === "ContactPicker");
  return has ? cap : null;
}

/** Inside the frfro app, but a version from before the contact picker: it has to be updated first. */
export function contactPickerNeedsAppUpdate() {
  return Boolean(nativeApp()) && !nativeContactPicker();
}

function webContactPickerSupported() {
  // Android's WebView exposes navigator.contacts too, but select() never opens anything there.
  if (nativeApp()) return false;
  return typeof navigator !== "undefined"
    && typeof window !== "undefined"
    && "contacts" in navigator
    && "ContactsManager" in window
    && typeof navigator.contacts?.select === "function";
}

export function contactPickerSupported() {
  return Boolean(nativeContactPicker()) || webContactPickerSupported();
}

function nativeContact(picked) {
  if (!picked || picked.cancelled) return null;
  const phones = [...new Set((picked.phones || []).map((value) => String(value).trim()).filter(Boolean))];
  return { name: String(picked.name || "").trim(), phones };
}

// While the phone's contact list is open Android may close frfro to free memory; the app then starts again on
// the home page and the pick was lost (owner's report 2026-11-02). Capacitor keeps the picked contact and hands
// it over as App «appRestoredResult» once the page listens, so the page notes where the pick started and finishes
// it there after the restart (useRestoredContact).
const PENDING_KEY = "frfro:contact-pick";
const PENDING_MS = 10 * 60 * 1000;
const RESTORED_EVENT = "frfro:contact-restored";
let restored = null; // { from, contact } waiting for the page that started the pick
let listening = false;

function notePending(from) {
  try {
    if (from) localStorage.setItem(PENDING_KEY, JSON.stringify({ from, at: Date.now() }));
  } catch {
    // without storage a lost pick stays lost, as before
  }
}

function takePending() {
  try {
    const value = JSON.parse(localStorage.getItem(PENDING_KEY) || "null");
    localStorage.removeItem(PENDING_KEY);
    return value && Date.now() - Number(value.at) < PENDING_MS ? String(value.from || "") : "";
  } catch {
    return "";
  }
}

function listenForRestoredPick() {
  const cap = nativeContactPicker();
  if (listening || !cap || typeof cap.addListener !== "function") return;
  listening = true;
  cap.addListener("App", "appRestoredResult", (event) => {
    if (event?.pluginId !== "ContactPicker" || event?.methodName !== "pick") return;
    const from = takePending();
    const contact = event.success ? nativeContact(event.data) : null;
    if (!from || !contact) return;
    restored = { from, contact };
    window.dispatchEvent(new CustomEvent(RESTORED_EVENT));
  });
}

/** The contact picked for `from` before the app was closed and started again, once; null otherwise. */
export function takeRestoredContact(from) {
  if (!restored || restored.from !== from) return null;
  const { contact } = restored;
  restored = null;
  return contact;
}

/** Calls `onContact(contact)` when a pick that started at `from` comes back after the app was closed and started again. */
export function useRestoredContact(from, onContact) {
  const latest = useRef(onContact);
  latest.current = onContact;
  useEffect(() => {
    listenForRestoredPick();
    const take = () => {
      const contact = takeRestoredContact(from);
      if (contact) latest.current(contact);
    };
    take();
    window.addEventListener(RESTORED_EVENT, take);
    return () => window.removeEventListener(RESTORED_EVENT, take);
  }, [from]);
}

/**
 * Opens the picker: `{ name, phones }` of the chosen contact, or null when nothing was chosen. `from` names the
 * place that asked, so a pick that outlives a restart of the app is finished there (useRestoredContact).
 */
export async function pickContact(from = "") {
  const cap = nativeContactPicker();
  if (cap) {
    listenForRestoredPick();
    notePending(from);
    try {
      return nativeContact(await cap.nativePromise("ContactPicker", "pick", {}));
    } finally {
      takePending();
    }
  }
  const picked = await navigator.contacts.select(["name", "tel"], { multiple: false });
  const contact = Array.isArray(picked) ? picked[0] : null;
  if (!contact) return null;
  const phones = [...new Set((contact.tel || []).map((value) => String(value).trim()).filter(Boolean))];
  return { name: String(contact.name?.[0] || "").trim(), phones };
}

/** Iranian mobile number (09…, +989…, 989…). */
export function isMobilePhone(text) {
  const digits = toLatinDigits(String(text || "")).replace(/\D/g, "");
  return /^(0098|98|0)?9\d{9}$/.test(digits);
}

/** The number to send an invitation SMS to: the contact's first mobile, else their first number. */
export function invitePhoneOf(phones = []) {
  return phones.find(isMobilePhone) || phones[0] || "";
}

/** A contact's number as the booking form takes it: an Iranian mobile as 09…, else the digits as they are. */
export function localPhoneOf(phones = []) {
  const digits = toLatinDigits(String(invitePhoneOf(phones))).replace(/\D/g, "");
  const mobile = digits.match(/^(?:0098|98|0)?(9\d{9})$/);
  return mobile ? `0${mobile[1]}` : digits;
}
