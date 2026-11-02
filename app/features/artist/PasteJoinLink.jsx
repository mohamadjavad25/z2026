"use client";

import { useRef, useState } from "react";
import { ClipboardPaste } from "lucide-react";
import { parseProfileLink } from "../../shared/lib/connectCodes";

/** The salon's team-join link (`…/join-salon/12?k=…`) in `text`, as the path to open here; "" when it is not one. */
export function joinPathFrom(text) {
  const value = String(text || "").trim();
  if (!/\/join-salon\/\d+/.test(value)) return "";
  const link = parseProfileLink(value);
  if (!link || link.type !== "salon" || !link.joinCode) return "";
  return `/join-salon/${link.id}?k=${encodeURIComponent(link.joinCode)}`;
}

/**
 * «لینک دعوت سالن رو اینجا بذار» (owner's decision 2026-11-02): a salon and an artist are not always side by side to
 * scan, so the salon sends its join link and the artist taps this box. The link is read from the clipboard; where the
 * phone does not allow that, the box turns into a field to paste into. A join link opens the same page scanning the
 * salon's code opens (the salon's card and terms, then «همکاری»), so nothing joins without the artist's own tap.
 */
export function PasteJoinLink() {
  const [typing, setTyping] = useState(false);
  const [message, setMessage] = useState("");
  const inputRef = useRef(null);

  function open(text) {
    const path = joinPathFrom(text);
    if (!path) {
      setMessage(String(text || "").trim()
        ? "این لینک دعوت همکاری نیست؛ از سالن بخواه لینک دعوت رو بفرسته."
        : "چیزی کپی نکردی؛ اول لینک رو از پیام سالن کپی کن.");
      return;
    }
    setMessage("");
    window.location.assign(path);
  }

  function showField() {
    setTyping(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function readClipboard() {
    setMessage("");
    let text = "";
    try {
      text = await navigator.clipboard.readText();
    } catch {
      // Not allowed here (an older app, or the person said no): paste by hand instead.
      showField();
      return;
    }
    open(text);
  }

  return (
    <div className="pjl">
      {typing ? (
        <label className="pjlField">
          <span>لینک دعوت سالن رو اینجا بچسبون</span>
          <input
            ref={inputRef}
            type="url"
            inputMode="url"
            dir="ltr"
            placeholder="frfro.ir/join-salon/…"
            onPaste={(event) => {
              event.preventDefault();
              open(event.clipboardData?.getData("text") || "");
            }}
            onChange={(event) => { if (joinPathFrom(event.target.value)) open(event.target.value); }}
          />
        </label>
      ) : (
        <button type="button" className="pjlBox" onClick={readClipboard}>
          <span aria-hidden="true"><ClipboardPaste size={20} /></span>
          <span><b>لینک دعوت سالن رو اینجا بذار</b><small>یه بار بزن؛ لینک خودش برداشته می‌شه</small></span>
        </button>
      )}
      {message ? <p className="pjlNote" role="status">{message}</p> : null}
    </div>
  );
}
