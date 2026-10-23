"use client";

import { Spinner } from "../../components/Spinner";
import { useState } from "react";
import { Check, Copy, ScanLine, Share2 } from "lucide-react";
import { ProfileSheet } from "../profile/ProfileSheet";
import { useQrCode } from "../../shared/hooks/useQrCode";
import { buildClientInviteText } from "../../shared/lib/inviteSms";
import { ScanFlow } from "./ScanFlow";

/**
 * «دعوت مشتری» for salons and artists (customers page): every way to bring the customers they already
 * have into frfro, in one place, shortest first:
 *  1. the QR of their page, to show or put on the counter: the customer scans it and taps «وصل شو»;
 *  2. a ready message with that link, for the customers who aren't there (WhatsApp, Telegram, SMS…);
 *  3. «اسکن کد مشتری»: the customer shows their own code («کد من») and is added at once.
 * Whoever connects shows up on the customers page, and the salon/artist on the customer's list.
 *
 * Props: open, url (their public page), name, viewerType ("salon" | "artist"), onChanged (after a scan), onClose
 */
export function InviteClientsSheet({ open, url = "", name = "", viewerType, onChanged, onClose }) {
  const qr = useQrCode(url, open && Boolean(url));
  const [copied, setCopied] = useState(false);
  const [scanning, setScanning] = useState(false);
  const text = buildClientInviteText({ placeName: name, url });

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked: the share button and the QR still work
    }
  }

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: name || "فرفرو", text });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    copyText();
  }

  return (
    <>
      <ProfileSheet open={open && !scanning} kicker="مشتری‌ها" title="دعوت مشتری‌ها" panelClassName="artistInviteSheet" onClose={onClose}>
        <section className="ivtHero" aria-label="دعوت با کد QR">
          <p className="ivtEyebrow">مشتری پیش توست؟</p>
          <h4 className="ivtTitle">این کد رو اسکن کنه و «وصل شو» رو بزنه</h4>
          <div className="ivtScan">
            <span className="ivtCorner is-tl" aria-hidden="true" />
            <span className="ivtCorner is-tr" aria-hidden="true" />
            <span className="ivtCorner is-bl" aria-hidden="true" />
            <span className="ivtCorner is-br" aria-hidden="true" />
            <div className="ivtQr">
              {qr ? <img src={qr} alt={`کد QR صفحهٔ ${name}`} /> : <span className="ivtQrWait"><Spinner size={44} /></span>}
            </div>
          </div>
          <p className="ivtHint">با دوربین گوشی هم باز می‌شه. چاپش کن و بذارش روی پیشخون تا هر مشتری خودش وصل بشه.</p>
        </section>

        <section className="ivtHero icsMessage" aria-label="فرستادن لینک برای مشتری‌ها">
          <p className="ivtEyebrow">برای بقیهٔ مشتری‌ها</p>
          <h4 className="ivtTitle">یه پیام آماده با لینک صفحه‌ت</h4>
          <p className="icsText">{text}</p>
          <div className="ivtActions">
            <button type="button" className="ivtShare" onClick={share} disabled={!url}>
              <Share2 size={17} aria-hidden="true" />
              بفرست برای مشتری‌ها
            </button>
            <button type="button" className={`ivtCopyBtn ${copied ? "is-done" : ""}`} onClick={copyText} disabled={!url} aria-label={copied ? "کپی شد" : "کپی متن"}>
              {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
              <span>{copied ? "کپی شد" : "کپی"}</span>
            </button>
          </div>
          <p className="ivtHint">توی واتس‌اپ، تلگرام یا پیامک بفرست برای مشتری‌ها یا گروهشون.</p>
        </section>

        <button type="button" className="qrsScanBtn icsScan" onClick={() => setScanning(true)}>
          <ScanLine size={18} aria-hidden="true" />
          اسکن کد مشتری
        </button>
        <p className="icsScanHint">مشتری توی فرفرو «کد من» رو باز کنه؛ اسکنش که کنی، همون لحظه می‌شه مشتریت.</p>
      </ProfileSheet>
      {scanning ? (
        <ScanFlow viewerType={viewerType} onChanged={onChanged} onClose={() => setScanning(false)} />
      ) : null}
    </>
  );
}
