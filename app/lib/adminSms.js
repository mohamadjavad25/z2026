import { adminPhoneList } from "./admin.js";
import { sendTemplateSms } from "./sms.js";
import { checkRateLimit } from "./rateLimit.js";
import { pushAdmins } from "./adminPush.js";

/**
 * Tells every FRFRO_ADMIN_PHONES admin, only about things someone is waiting on the operator for (support).
 * Sign-ups and other routine events are not sent, to keep the SMS bill down. An admin with the «فرفرو مدیر»
 * app gets a push for every one of them and no SMS (adminPush.js); the others get the pattern SMS
 * (smsTemplates.js: admin_support, off until its pattern is set). Fire-and-forget: never throws and never
 * delays the response.
 */

const QUIET_MS = 15 * 60 * 1000;

const SUPPORT_TOPICS = {
  question: "سؤال",
  bug: "مشکل فنی",
  complaint: "شکایت",
  account: "حساب کاربری",
  other: "پیام"
};

/** Which admin page a push opens, by `kind`. */
const PAGES = {
  "password-reset": "resets",
  report: "reports"
};

/**
 * Someone needs the operator. `kind` groups the SMS throttle: at most one SMS per kind every 15 minutes, so a burst
 * of messages (or one person writing many) costs one SMS; the panel shows them all. Pushes cost nothing and are not
 * throttled.
 */
export function smsAdminsSupport(kind, { topic, who }) {
  void (async () => {
    const phones = adminPhoneList();
    if (!phones.length) return;
    const values = {
      topic: String(topic || "پیام").slice(0, 30),
      who: String(who || "").trim().slice(0, 40) || "بدون نام"
    };
    const reached = await pushAdmins({
      title: values.topic,
      body: `از ${values.who}`,
      url: `/admin?p=${PAGES[kind] || "support"}`
    });
    const rest = phones.filter((phone) => !reached.has(phone));
    if (!rest.length) return;
    if (!(await checkRateLimit(`admin-sms:${kind}`, 1, QUIET_MS)).ok) return;
    await Promise.allSettled(rest.map((phone) => sendTemplateSms(phone, "admin_support", values)));
  })().catch(() => {});
}

export const supportTopic = (category) => SUPPORT_TOPICS[category] || SUPPORT_TOPICS.other;
