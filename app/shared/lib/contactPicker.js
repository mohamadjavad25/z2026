import { toLatinDigits } from "./digits.js";

/**
 * The phone's contact picker (Chrome on Android). It shows the system's own list, so frfro only ever
 * sees the one contact the person picks. Elsewhere (iPhone, desktop) it doesn't exist.
 */
export function contactPickerSupported() {
  return typeof navigator !== "undefined"
    && typeof window !== "undefined"
    && "contacts" in navigator
    && "ContactsManager" in window
    && typeof navigator.contacts?.select === "function";
}

/** Opens the picker: `{ name, phones }` of the chosen contact, or null when nothing was chosen. */
export async function pickContact() {
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

/** A contact's number as a local mobile (09…) the booking form expects; other numbers come back as plain digits. */
export function localMobile(text) {
  const digits = toLatinDigits(String(text || "")).replace(/\D/g, "");
  const match = digits.match(/^(?:0098|98|0)?(9\d{9})$/);
  return match ? `0${match[1]}` : digits;
}
