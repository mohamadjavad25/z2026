"use client";

import { useEffect, useState } from "react";
import { Check, Copy, MessageSquareText, Share2 } from "lucide-react";
import { buildInviteSmsHref, buildInviteText, phoneForSms } from "../../shared/lib/inviteSms";

/**
 * For a salon/artist the client couldn't find: they aren't on frfro yet, so the client invites them.
 * With a phone number, the client's own messages app opens with the text ready (nothing is sent by
 * frfro). Without one, the share sheet carries the text; where there is no share sheet (the frfro
 * Android app's WebView has none), the messages app opens with the text and the client picks the
 * contact. The text can always be copied too, with a visible «کپی شد».
 */
export function InviteToFrfro({ phone = "", clientName = "", category = "" }) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const text = buildInviteText({ name: clientName, category, url: origin });
  const smsHref = phoneForSms(phone) ? buildInviteSmsHref(phone, text) : "";
  // Known only in the browser; until then the button tries the share sheet and falls back by itself.
  const [canShare, setCanShare] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Older WebViews: copy through a hidden field instead.
      const field = document.createElement("textarea");
      field.value = text;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      try { document.execCommand("copy"); } catch { /* nothing else to try */ }
      field.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "فرفرو", text });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    copyText();
  }

  const copyLabel = copied ? "متن دعوت کپی شد" : "کپی متن دعوت";
  const CopyIcon = copied ? Check : Copy;

  if (smsHref) {
    return (
      <div className="cnInviteRow">
        <a className="cnInviteBtn" href={smsHref}>
          <MessageSquareText size={16} aria-hidden="true" />
          پیامک دعوت
        </a>
        <button type="button" className="cnGhostBtn" onClick={canShare ? share : copyText}>
          {canShare ? (copied ? "متن دعوت کپی شد" : "یه راه دیگه") : copyLabel}
        </button>
      </div>
    );
  }

  if (!canShare) {
    return (
      <div className="cnInviteRow">
        <a className="cnInviteBtn" href={`sms:?&body=${encodeURIComponent(text)}`}>
          <MessageSquareText size={16} aria-hidden="true" />
          دعوتش کن به فرفرو
        </a>
        <button type="button" className="cnGhostBtn cnCopyBtn" onClick={copyText}>
          <CopyIcon size={15} aria-hidden="true" />
          {copyLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="cnInviteRow">
      <button type="button" className="cnInviteBtn" onClick={share}>
        {copied ? <Check size={16} aria-hidden="true" /> : <Share2 size={16} aria-hidden="true" />}
        {copied ? "متن دعوت کپی شد" : "دعوتش کن به فرفرو"}
      </button>
    </div>
  );
}
