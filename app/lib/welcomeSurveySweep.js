import { sendPushToUser } from "./push.js";
import { tehranDaytime } from "./dueReminderSweep.js";
import { claimPush, peopleToPush } from "./db/repos/welcomeSurvey.js";
import { pushText } from "../shared/lib/welcomeSurvey.js";

/**
 * The welcome survey's one push, with the person's own name and numbers. Daytime only. Someone with no phone or
 * browser to reach sees the survey the next time they open frfro, so nothing is lost. Runs with the reminders.
 */
export async function sweepWelcomeSurvey(now = new Date()) {
  const result = { candidates: 0, sent: 0 };
  if (!tehranDaytime(now)) return result;
  const people = await peopleToPush();
  result.candidates = people.length;
  for (const person of people) {
    if (!(await claimPush(person.id))) continue;
    const sent = await sendPushToUser(person.id, { ...pushText(person), url: "/", ttl: 24 * 3600 }).catch(() => null);
    if (sent?.sent) result.sent += 1;
  }
  return result;
}
