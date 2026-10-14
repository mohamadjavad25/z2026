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

/** Opens the picker: `{ name, phones }` of the chosen contact, or null when nothing was chosen. */
export async function pickContact() {
  const cap = nativeContactPicker();
  if (cap) {
    const picked = await cap.nativePromise("ContactPicker", "pick", {});
    if (!picked || picked.cancelled) return null;
    const phones = [...new Set((picked.phones || []).map((value) => String(value).trim()).filter(Boolean))];
    return { name: String(picked.name || "").trim(), phones };
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
