import { toLatinDigits } from "../../shared/lib/digits.js";

const MOBILE = /^09\d{9}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Persian, field-level validation for the auth forms. The browser's own
 *  constraint validation (required/pattern) speaks the browser's language
 *  (English for most phones), so the forms use noValidate and call these. */
export function validateLogin(data) {
  const errors = {};
  const phone = toLatinDigits(String(data.phone || "").trim());
  if (!phone) errors.phone = "شماره تماس را وارد کن.";
  else if (!MOBILE.test(phone)) errors.phone = "شماره موبایل معتبر وارد کن؛ مثلاً ۰۹۱۲۳۴۵۶۷۸۹.";
  if (!String(data.password || "")) errors.password = "رمز عبور را وارد کن.";
  return errors;
}

const NAME_MESSAGE = {
  salon: "نام سالن را وارد کن.",
  artist: "نام هنری را وارد کن.",
  client: "نام خودت را وارد کن."
};
const AREA_MESSAGE = {
  salon: "محدوده فعالیت سالن را وارد کن.",
  artist: "محدوده یا سالن محل کار را وارد کن.",
  client: "شهر و محدوده را وارد کن."
};

export function validateSignup(type, data) {
  const errors = validateLogin(data);
  if (!String(data.name || "").trim()) errors.name = NAME_MESSAGE[type] || NAME_MESSAGE.client;
  if (!String(data.area || "").trim()) errors.area = AREA_MESSAGE[type] || AREA_MESSAGE.client;
  if ((type === "salon" || type === "artist") && !String(data.service || "").trim()) {
    errors.service = "حداقل یک مورد انتخاب کن.";
  }
  const password = String(data.password || "");
  if (password && password.trim().length < 8) errors.password = "رمز عبور باید حداقل ۸ کاراکتر باشد.";
  const email = String(data.email || "").trim();
  if (email && !EMAIL.test(email)) errors.email = "ایمیل معتبر نیست؛ یا آن را خالی بگذار.";
  if (!data.agreeTerms) errors.agreeTerms = "برای ادامه باید قوانین و حریم خصوصی را قبول کنی.";
  return errors;
}

/** Order the fields appear in, so focus can jump to the first problem. */
export const FIELD_ORDER = ["name", "area", "service", "phone", "password", "email", "agreeTerms"];
export function firstInvalidField(errors) {
  return FIELD_ORDER.find((field) => errors[field]) || Object.keys(errors)[0] || null;
}
