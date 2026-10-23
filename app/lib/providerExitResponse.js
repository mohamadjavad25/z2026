import { json } from "./http.js";
import { describePlan } from "./db/repos/providerExit.js";
import { blockedByNearText, blockedTeamText } from "../shared/lib/providerRules.js";

export const HAS_BOOKINGS_TEXT = "چند نوبت تأییدشدهٔ دورتر هم داری. هرکدام را جدا لغو کن (مشتری باخبر می‌شود)، یا همه را با یک دکمه لغو کن و پیامک بفرست.";
export const HAS_BOOKINGS_TEAM_TEXT = "چند نوبت تأییدشدهٔ دورتر با این آرتیست هست. هرکدام را به آرتیست دیگری واگذار کن (مشتری باید قبول کند) یا با اطلاع مشتری لغو کن.";

/** The 409 a refused leaving answers with: the Persian sentence, a code, and the plan the dialog draws. */
export async function exitRefusal(result, { scope }) {
  const view = await describePlan(result.plan);
  const team = scope !== "account";
  if (result.code === "NEAR_BOOKINGS") {
    const error = team ? blockedTeamText(result.plan.near.length, scope === "staff") : blockedByNearText(result.plan.near.length);
    return json({ error, code: "NEAR_BOOKINGS", data: { plan: view } }, { status: 409 });
  }
  return json({ error: team ? HAS_BOOKINGS_TEAM_TEXT : HAS_BOOKINGS_TEXT, code: "HAS_BOOKINGS", data: { plan: view } }, { status: 409 });
}
