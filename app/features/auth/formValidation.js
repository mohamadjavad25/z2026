import { toLatinDigits } from "../../shared/lib/digits.js";

const MOBILE = /^09\d{9}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Persian, field-level validation for the auth forms. The browser's own
 *  constraint validation (required/pattern) speaks the browser's language
 *  (English for most phones), so the forms use noValidate and call these. */
export function validateLogin(data) {
  const errors = {};
  const phone = toLatinDigits(String(data.phone || "").trim());
  if (!phone) errors.phone = "شماره موبایلت رو بزن.";
  else if (!MOBILE.test(phone)) errors.phone = "این شماره درست نیست؛ مثلاً ۰۹۱۲۳۴۵۶۷۸۹";
  if (!String(data.password || "")) errors.password = "یه رمز بذار؛ دست‌کم ۸ حرف.";
  return errors;
}

const NAME_MESSAGE = {
  salon: "اسم سالنت چیه؟",
  artist: "اسم هنریت چیه؟",
  client: "اسمت چیه؟"
};

export function validateSignup(type, data) {
  const errors = validateLogin(data);
  if (!String(data.name || "").trim()) errors.name = NAME_MESSAGE[type] || NAME_MESSAGE.client;
  // Area and specialty are NOT asked at signup: owners fill them with one tap from the
  // profile-completeness card, so creating an account stays name + phone + password.
  const password = String(data.password || "");
  if (password && password.trim().length < 8) errors.password = "رمز دست‌کم ۸ حرف باشه.";
  const email = String(data.email || "").trim();
  if (email && !EMAIL.test(email)) errors.email = "این ایمیل درست نیست؛ یا درستش کن یا خالی بذار.";
  if (!data.agreeTerms) errors.agreeTerms = "اول تیک قوانین رو بزن.";
  return errors;
}

/** Order the fields appear in, so focus can jump to the first problem. */
export const FIELD_ORDER = ["name", "area", "service", "phone", "password", "email", "agreeTerms"];
export function firstInvalidField(errors) {
  return FIELD_ORDER.find((field) => errors[field]) || Object.keys(errors)[0] || null;
}
