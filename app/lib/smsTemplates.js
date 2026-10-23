/**
 * Pattern (template) SMS beyond the verification code. Iranian providers only send ready-approved patterns for
 * service messages, so each message here is a pattern the operator creates once in the provider's panel and names in
 * an env var. A message whose pattern is not set is simply not sent (the push notification still goes).
 *
 * For each template:
 *   env        -> KAVENEGAR_TEMPLATE_<env> (Kavenegar verify/lookup template) or FARAZSMS_PATTERN_<env> (Faraz pattern code)
 *   kavenegar  -> the lookup tokens. token, token2, token3 may not contain spaces; token10 may (up to 5 spaces).
 *   faraz      -> the pattern's variables, by name (write the pattern with exactly these names, e.g. %amount%).
 *   preview    -> the text as the operator should write it in the panel; also what the "test" provider logs.
 * Full setup steps: docs/OPERATIONS.md («پیامک اشتراک»).
 */
export const SMS_TEMPLATES = {
  booking_request: {
    label: "درخواست نوبت تازه (به سالن یا آرتیست)",
    env: "BOOKING_REQUEST",
    kavenegar: (v) => ({ token: v.time, token10: v.day, token20: v.who }),
    faraz: (v) => ({ who: v.who, day: v.day, time: v.time }),
    preview: (v) => `فرفرو: درخواست تازه از ${v.who}، ${v.day} ساعت ${v.time}. توی اپ جواب بده.`
  },
  booking_answer: {
    label: "جواب درخواست نوبت (به مشتری)",
    env: "BOOKING_ANSWER",
    kavenegar: (v) => ({ token: v.time, token10: v.day, token20: `${v.who} ${v.result}` }),
    faraz: (v) => ({ who: v.who, day: v.day, time: v.time, result: v.result }),
    preview: (v) => `فرفرو: نوبتت ${v.day} ساعت ${v.time} توی ${v.who} ${v.result}.`
  },
  booking_reminder: {
    label: "یادآوری نوبت، دو ساعت قبل (به مشتری بدون اعلان)",
    env: "BOOKING_REMINDER",
    kavenegar: (v) => ({ token: v.time, token10: v.who }),
    faraz: (v) => ({ who: v.who, time: v.time }),
    preview: (v) => `فرفرو: یادت نره، امروز ساعت ${v.time} توی ${v.who} نوبت داری.`
  },
  booking_cancelled: {
    label: "لغو نوبت از طرف مشتری (به سالن یا آرتیست)",
    env: "BOOKING_CLIENT_CANCELLED",
    kavenegar: (v) => ({ token: v.time, token10: v.day, token20: v.who }),
    faraz: (v) => ({ who: v.who, day: v.day, time: v.time }),
    preview: (v) => `فرفرو: ${v.who} نوبت ${v.day} ساعت ${v.time} رو لغو کرد.`
  },
  booking_cancelled_by_provider: {
    label: "لغو نوبت تأییدشده از طرف سالن یا آرتیست (به مشتری)",
    env: "BOOKING_CANCELLED",
    kavenegar: (v) => ({ token: v.time, token10: v.day, token20: v.who }),
    faraz: (v) => ({ who: v.who, day: v.day, time: v.time }),
    preview: (v) => `فرفرو: ${v.who} نوبتت (${v.day} ساعت ${v.time}) رو لغو کرد. ببخشید که این‌طوری شد؛ یه نوبت دیگه از فرفرو بگیر.`
  },
  booking_cancelled_gone: {
    label: "لغو نوبت چون سالن یا آرتیست از فرفرو رفته (به مشتری)",
    env: "BOOKING_GONE",
    kavenegar: (v) => ({ token: v.time, token10: v.day, token20: v.who }),
    faraz: (v) => ({ who: v.who, day: v.day, time: v.time }),
    preview: (v) => `فرفرو: ${v.who} دیگه توی فرفرو نیست و نوبتت (${v.day} ساعت ${v.time}) لغو شد. یه نوبت دیگه از فرفرو بگیر.`
  },
  booking_time_proposal: {
    label: "پیشنهاد ساعت دیگه برای نوبت تأییدشده (به مشتری)",
    env: "BOOKING_PROPOSAL",
    kavenegar: (v) => ({ token: v.from, token2: v.to, token10: v.who }),
    faraz: (v) => ({ who: v.who, from: v.from, to: v.to }),
    preview: (v) => `فرفرو: ${v.who} می‌خواد نوبتت رو از ${v.from} ببره به ${v.to}. قبول می‌کنی؟ توی فرفرو جواب بده؛ تا جواب ندی، ساعت قبلی سر جاشه.`
  },
  booking_handover_proposal: {
    label: "پیشنهاد آرتیست دیگه برای نوبت تأییدشده (به مشتری)",
    env: "BOOKING_HANDOVER",
    kavenegar: (v) => ({ token: v.time, token10: v.day, token20: v.who }),
    faraz: (v) => ({ who: v.who, day: v.day, time: v.time, artist: v.artist }),
    preview: (v) => `فرفرو: ${v.who} می‌خواد نوبتت (${v.day} ساعت ${v.time}) رو بده به ${v.artist}. قبول می‌کنی؟ توی فرفرو جواب بده؛ تا جواب ندی، همه‌چی سر جاشه.`
  },
  billing_receipt: {
    label: "رسید پرداخت اشتراک",
    env: "BILLING_RECEIPT",
    kavenegar: (v) => ({ token: v.receipt, token2: v.amount, token3: v.until }),
    faraz: (v) => ({ receipt: v.receipt, amount: v.amount, until: v.until }),
    preview: (v) => `فرفرو: اشتراکت تا ${v.until} فعال شد. ${v.amount} تومان، رسید ${v.receipt}.`
  },
  billing_reminder: {
    label: "یادآوری پایان اشتراک",
    env: "BILLING_REMINDER",
    kavenegar: (v) => ({ token: v.days, token2: v.until }),
    faraz: (v) => ({ days: v.days, until: v.until }),
    preview: (v) => `فرفرو: اشتراکت ${v.days} روز دیگه (${v.until}) تموم می‌شه. برای تمدید: تنظیمات، اشتراک من.`
  },
  billing_ended: {
    label: "پایان اشتراک (شروع مهلت)",
    env: "BILLING_ENDED",
    kavenegar: (v) => ({ token: v.days }),
    faraz: (v) => ({ days: v.days }),
    preview: (v) => `فرفرو: اشتراکت تموم شد. ${v.days} روز وقت داری تمدید کنی تا توی جست‌وجو بمونی.`
  },
  billing_closed: {
    label: "غیرفعال شدن حساب",
    env: "BILLING_CLOSED",
    kavenegar: (v) => ({ token: v.since }),
    faraz: (v) => ({ since: v.since }),
    preview: (v) => `فرفرو: از ${v.since} توی جست‌وجو دیده نمی‌شی و نوبت آنلاین نمی‌گیری. تمدید کنی، همه‌چی برمی‌گرده.`
  },
  billing_admin: {
    label: "خبر پرداخت برای مدیر",
    env: "BILLING_ADMIN",
    kavenegar: (v) => ({ token: v.amount, token2: v.receipt, token10: v.who }),
    faraz: (v) => ({ amount: v.amount, receipt: v.receipt, who: v.who }),
    preview: (v) => `فرفرو، پرداخت تازه: ${v.who}، ${v.amount} تومان، رسید ${v.receipt}.`
  },
  admin_support: {
    label: "درخواست پشتیبانی (برای مدیر)",
    env: "ADMIN_SUPPORT",
    kavenegar: (v) => ({ token10: v.topic, token20: v.who }),
    faraz: (v) => ({ topic: v.topic, who: v.who }),
    preview: (v) => `فرفرو، درخواست پشتیبانی. موضوع: ${v.topic}، از: ${v.who}. در پنل مدیریت ببین.`
  }
};

/** Kavenegar rejects spaces in token, token2 and token3: replace them so a value never breaks a send. */
export function kavenegarSafe(tokens) {
  return Object.fromEntries(Object.entries(tokens).map(([key, value]) => {
    const text = String(value ?? "").trim() || "-";
    return [key, key === "token10" || key === "token20" ? text : text.replace(/\s+/g, "_")];
  }));
}
