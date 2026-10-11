import { toLatinDigits } from "./digits.js";

/** Digits of a phone as typed (Persian or Latin digits, spaces, dashes), with a leading + kept; "" when it is too short. */
export function phoneForSms(text) {
  const raw = toLatinDigits(String(text || "")).trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7) return "";
  return raw.startsWith("+") ? `+${digits}` : digits;
}

/**
 * The message a client sends to a salon/artist who isn't on frfro yet. It names what the client wants,
 * so the person knows why they are being asked to join.
 */
export function buildInviteText({ name = "", category = "", url = "" } = {}) {
  const who = String(name || "").trim();
  const wants = category ? `برای «${category}» ` : "";
  return `سلام${who ? `، من ${who} هستم` : ""} و می‌خواهم ${wants}از فرفرو نوبت بگیرم. اینجا ثبت‌نام کن تا وصل شویم: ${url}`.trim();
}

/** `sms:` link that opens the phone's messages app with the text filled in (the `?&` form works on both Android and iOS). */
export function buildInviteSmsHref(phone, text) {
  const number = phoneForSms(phone);
  if (!number) return "";
  return `sms:${number}?&body=${encodeURIComponent(text)}`;
}
