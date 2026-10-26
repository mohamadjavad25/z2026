import { json } from "./http.js";
import { describePlan } from "./db/repos/providerExit.js";
import { describeClientPlan } from "./db/repos/clientExit.js";
import { blockedByNearText, blockedTeamText } from "../shared/lib/providerRules.js";
import { clientBlockedText, clientRestText } from "../shared/lib/clientExitText.js";

export const HAS_BOOKINGS_TEXT = "چند تا نوبت تأییدشدهٔ دورتر هم داری. یکی‌یکی لغوشون کن (مشتری خبردار می‌شه)، یا همه رو با یه دکمه لغو کن و پیامک بفرست.";
export const HAS_BOOKINGS_TEAM_TEXT = "چند تا نوبت تأییدشدهٔ دورتر با این آرتیست هست. هرکدوم رو بده به یه آرتیست دیگه (مشتری باید قبول کنه)، یا لغوش کن تا مشتری خبردار بشه.";

/** The 409 a refused leaving answers with: the Persian sentence, a code, and the plan the dialog draws. */
export async function exitRefusal(result, { scope }) {
  // A client's own plan (clientExit.js): its own words.
  if (result.plan?.rest) {
    const view = describeClientPlan(result.plan);
    const error = result.code === "NEAR_BOOKINGS" ? clientBlockedText(result.plan.near.length) : clientRestText(result.plan.rest);
    return json({ error, code: result.code, data: { plan: view } }, { status: 409 });
  }
  const view = await describePlan(result.plan);
  const team = scope !== "account";
  if (result.code === "NEAR_BOOKINGS") {
    const error = team ? blockedTeamText(result.plan.near.length, scope === "staff") : blockedByNearText(result.plan.near.length);
    return json({ error, code: "NEAR_BOOKINGS", data: { plan: view } }, { status: 409 });
  }
  return json({ error: team ? HAS_BOOKINGS_TEAM_TEXT : HAS_BOOKINGS_TEXT, code: "HAS_BOOKINGS", data: { plan: view } }, { status: 409 });
}
