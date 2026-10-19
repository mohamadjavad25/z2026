import { adminPhoneList } from "./admin.js";
import { sendTemplateSms } from "./sms.js";

/**
 * Pattern SMS to every FRFRO_ADMIN_PHONES number, for events the operator wants to hear about away from the panel.
 * Off until its pattern is set (smsTemplates.js). Fire-and-forget: never throws and never delays the response.
 */
function smsAdmins(key, values) {
  void Promise.allSettled(adminPhoneList().map((phone) => sendTemplateSms(phone, key, values))).catch(() => {});
}

/** A salon or an artist just signed up (clients are not reported: there are too many of them). */
export function smsAdminsNewAccount({ type, name, area }) {
  if (type !== "salon" && type !== "artist") return;
  const who = [name, area].map((part) => String(part || "").trim()).filter(Boolean).join("، ").slice(0, 40) || "بدون نام";
  smsAdmins("admin_new_account", { role: type === "salon" ? "سالن" : "آرتیست", who });
}
