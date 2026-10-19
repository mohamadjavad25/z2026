import { adminPhoneList } from "./admin.js";
import { sendTemplateSms } from "./sms.js";
import { checkRateLimit } from "./rateLimit.js";

/**
 * Pattern SMS to every FRFRO_ADMIN_PHONES number, only for things someone is waiting on the operator for (support).
 * Sign-ups and other routine events are not texted, to keep the SMS bill down. Off until its pattern is set
 * (smsTemplates.js: admin_support). Fire-and-forget: never throws and never delays the response.
 */

const QUIET_MS = 15 * 60 * 1000;

const SUPPORT_TOPICS = {
  question: "سؤال",
  bug: "مشکل فنی",
  complaint: "شکایت",
  account: "حساب کاربری",
  other: "پیام"
};

/**
 * Someone needs the operator. `kind` groups the throttle: at most one SMS per kind every 15 minutes, so a burst of
 * messages (or one person writing many) costs one SMS; the panel shows them all.
 */
export function smsAdminsSupport(kind, { topic, who }) {
  void (async () => {
    const phones = adminPhoneList();
    if (!phones.length) return;
    if (!(await checkRateLimit(`admin-sms:${kind}`, 1, QUIET_MS)).ok) return;
    const values = {
      topic: String(topic || "پیام").slice(0, 30),
      who: String(who || "").trim().slice(0, 40) || "بدون نام"
    };
    await Promise.allSettled(phones.map((phone) => sendTemplateSms(phone, "admin_support", values)));
  })().catch(() => {});
}

export const supportTopic = (category) => SUPPORT_TOPICS[category] || SUPPORT_TOPICS.other;
