import { sendPushToUser } from "./push.js";
import { tehranDaytime } from "./dueReminderSweep.js";
import { DAILY_PUSH_CAP, claimPush, peopleToPush, pushedInLastDay } from "./db/repos/welcomeSurvey.js";
import { pushText } from "../shared/lib/welcomeSurvey.js";

/**
 * The welcome survey's one push, with the person's own name and numbers. Daytime only. Someone with no phone or
 * browser to reach sees the survey the next time they open frfro, so nothing is lost. Runs with the reminders.
 */
export async function sweepWelcomeSurvey(now = new Date()) {
  const result = { candidates: 0, sent: 0 };
  if (!tehranDaytime(now)) return result;
  // At most DAILY_PUSH_CAP in any 24 hours, so the first run does not push every old account at once.
  const room = DAILY_PUSH_CAP - (await pushedInLastDay());
  if (room <= 0) return result;
  const people = await peopleToPush(room);
  result.candidates = people.length;
  for (const person of people) {
    if (!(await claimPush(person.id))) continue;
    const sent = await sendPushToUser(person.id, { ...pushText(person), url: "/", ttl: 24 * 3600, appFirst: true }).catch(() => null);
    if (sent?.sent) result.sent += 1;
  }
  return result;
}
