"use client";

import { MessageSquareText, Share2 } from "lucide-react";
import { buildInviteSmsHref, buildInviteText, phoneForSms } from "../../shared/lib/inviteSms";

/**
 * For a salon/artist the client couldn't find: they aren't on frfro yet, so the client invites them.
 * With a phone number, the client's own messages app opens with the text ready (nothing is sent by
 * frfro); without one, the share sheet / clipboard carries the same text.
 */
export function InviteToFrfro({ phone = "", clientName = "", category = "" }) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const text = buildInviteText({ name: clientName, category, url: origin });
  const smsHref = phoneForSms(phone) ? buildInviteSmsHref(phone, text) : "";

  async function share() {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "فرفرو", text, url: origin });
        return;
      }
      await navigator.clipboard.writeText(text);
    } catch {
      // share sheet dismissed / clipboard blocked: nothing to undo
    }
  }

  return (
    <div className="cnInviteRow">
      {smsHref ? (
        <a className="cnInviteBtn" href={smsHref}>
          <MessageSquareText size={16} aria-hidden="true" />
          پیامک دعوت
        </a>
      ) : null}
      <button type="button" className={smsHref ? "cnGhostBtn" : "cnInviteBtn"} onClick={share}>
        {smsHref ? null : <Share2 size={16} aria-hidden="true" />}
        {smsHref ? "راه دیگر" : "دعوتش کن به فرفرو"}
      </button>
    </div>
  );
}
