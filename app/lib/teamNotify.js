import { addTeamNotice, cleanReason } from "./db/repos/teamNotices.js";
import { pushReachedApp, sendPushToUser } from "./push.js";
import { sendTemplateSms } from "./sms.js";
import * as users from "./db/repos/users.js";

/**
 * A salon took an artist off its team, or an artist left one (owner's decision 2026-10-25): the other side gets a card
 * inside the app that stays until «باشه», a push, and an SMS unless the push reached their Android app (the usual
 * push-instead-of-SMS rule). Fire-and-forget: nothing here may fail the removal itself.
 *
 * kind "removed": `toUserId` is the artist, `from` the salon. kind "left": `toUserId` is the salon, `from` the artist.
 */
export function notifyTeamEnd({ kind, toUserId, from, reason = "" }) {
  const id = Number(toUserId || 0);
  if (!id) return;
  const name = String(from?.name || "").trim() || (kind === "removed" ? "سالن" : "یه آرتیست");
  const line = cleanReason(reason);
  void (async () => {
    await addTeamNotice(id, { kind, fromUserId: from?.id, fromName: name, reason: kind === "removed" ? line : "" });
    const push = sendPushToUser(id, kind === "removed"
      ? { title: `همکاری با ${name} تموم شد`, body: line ? `${name} تو رو از تیمش برداشت: «${line}»` : `${name} تو رو از تیمش برداشت. نوبت‌های خودت سر جاشه.`, url: "/" }
      : { title: "یه آرتیست از تیم رفت", body: `${name} دیگه با سالنت کار نمی‌کنه.`, url: "/" });
    if (await pushReachedApp(push)) return;
    const user = await users.getUserById(id);
    await sendTemplateSms(user?.phone || "", kind === "removed" ? "team_removed" : "team_left", { who: name });
  })().catch(() => {});
}
