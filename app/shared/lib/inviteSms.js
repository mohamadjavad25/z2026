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
  return `سلام${who ? `، ${who} هستم` : ""}! می‌خوام ${wants}از فرفرو ازت نوبت بگیرم. اینجا ثبت‌نام کن تا وصل بشیم و نوبت‌هات یه‌جا باشه: ${url}`.trim();
}

/**
 * The message a salon/artist sends to their own customers: the link to their page, where one tap on
 * «وصل شو» puts them in the customer's «سالن و آرتیست من» and the next booking is a few taps.
 */
export function buildClientInviteText({ placeName = "", url = "" } = {}) {
  const place = String(placeName || "").trim();
  return `سلام! از این به بعد می‌تونی نوبتت رو${place ? ` از «${place}»` : ""} یه‌راست توی فرفرو بگیری، بی‌زنگ و بی‌انتظار. این لینک رو باز کن و «وصل شو» رو بزن: ${url}`.trim();
}

/** `sms:` link that opens the phone's messages app with the text filled in (the `?&` form works on both Android and iOS). */
export function buildInviteSmsHref(phone, text) {
  const number = phoneForSms(phone);
  if (!number) return "";
  return `sms:${number}?&body=${encodeURIComponent(text)}`;
}
