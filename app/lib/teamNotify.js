import { addTeamNotice, cleanReason } from "./db/repos/teamNotices.js";
import { pushReachedApp, sendPushToUser } from "./push.js";
import { sendTemplateSms } from "./sms.js";
import * as users from "./db/repos/users.js";
import { TEAM_URL } from "./connectionNotify.js";

/**
 * A salon took an artist off its team, or an artist left one (owner's decision 2026-10-25): the other side gets a card
 * inside the app that stays until «باشه», a push, and an SMS unless the push reached their Android app (the usual
 * push-instead-of-SMS rule). Fire-and-forget: nothing here may fail the removal itself.
 *
 * kind "removed": `toUserId` is the artist, `from` the salon. kind "left": `toUserId` is the salon, `from` the artist.
 * kind "gone": a salon deleted its account (owner's decision 2026-10-30); every team artist gets the same three messages.
 * The account is about to disappear, so the card keeps no link to it.
 */
export function notifyTeamEnd({ kind, toUserId, from, reason = "" }) {
  const id = Number(toUserId || 0);
  if (!id) return;
  const name = String(from?.name || "").trim() || (kind === "left" ? "یه آرتیست" : "سالن");
  const line = cleanReason(reason);
  void (async () => {
    await addTeamNotice(id, { kind, fromUserId: kind === "gone" ? null : from?.id, fromName: name, reason: kind === "removed" ? line : "" });
    const push = sendPushToUser(id, kind === "gone"
      ? { title: `همکاری با ${name} تموم شد`, body: `${name} حسابش رو پاک کرد. نوبت‌های خودت سر جاشه.`, url: "/" }
      : kind === "removed"
      ? { title: `همکاری با ${name} تموم شد`, body: line ? `${name} تو رو از تیمش برداشت: «${line}»` : `${name} تو رو از تیمش برداشت. نوبت‌های خودت سر جاشه.`, url: "/" }
      : { title: "یه آرتیست از تیم رفت", body: `${name} دیگه با سالنت کار نمی‌کنه.`, url: "/" });
    if (await pushReachedApp(push)) return;
    const user = await users.getUserById(id);
    await sendTemplateSms(user?.phone || "", kind === "gone" ? "team_salon_gone" : kind === "removed" ? "team_removed" : "team_left", { who: name });
  })().catch(() => {});
}

/**
 * An artist came into a salon's team (owner's decision 2026-11-04, after the owner's salon heard nothing): told the same
 * way as an end, to the side that did not tap: the card until «باشه», a push, and an SMS unless the push reached their app.
 * kind "joined": `toUserId` is the salon, `from` the artist (she accepted its invite, or joined with its code or link).
 * kind "accepted": `toUserId` is the artist, `from` the salon (it accepted her request).
 */
export function notifyTeamJoin({ kind, toUserId, from }) {
  const id = Number(toUserId || 0);
  if (!id || (kind !== "joined" && kind !== "accepted")) return;
  const name = String(from?.name || "").trim() || (kind === "joined" ? "یه آرتیست" : "سالن");
  void (async () => {
    await addTeamNotice(id, { kind, fromUserId: from?.id, fromName: name });
    const push = sendPushToUser(id, kind === "joined"
      ? { title: `${name} اومد توی تیمت`, body: "از الان نوبت‌ها رو می‌تونی به اسمش ثبت کنی.", url: TEAM_URL }
      : { title: `حالا توی تیم ${name} هستی`, body: "پیشنهادت رو قبول کرد. روزها و ساعتت توی «همکاری» هست.", url: TEAM_URL });
    if (await pushReachedApp(push)) return;
    const user = await users.getUserById(id);
    await sendTemplateSms(user?.phone || "", kind === "joined" ? "team_joined" : "team_accepted", { who: name });
  })().catch(() => {});
}
