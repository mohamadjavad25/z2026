"use client";

import { Spinner } from "../../components/Spinner";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, X } from "lucide-react";
import { getMyConnectCode } from "../../shared/api/connections";
import { useQrCode } from "../../shared/hooks/useQrCode";
import { useBackHandler } from "../../shared/hooks/useBackHandler";
import { hasNativeStoryShare, saveStoryNative } from "../../shared/lib/storyShare";
import { appTooOldFor, askForAppUpdate } from "../../shared/lib/appUpdate";

/**
 * «اسکن شو»: the client's personal QR. A salon or artist scans it (from their
 * customers page) to add the client; both then appear in each other's lists.
 */
export function MyCodeSheet({ name = "", avatar = "", onClose }) {
  useBackHandler(true, onClose);
  const [code, setCode] = useState("");
  const [failed, setFailed] = useState(false);
  const qr = useQrCode(code, Boolean(code));
  const [saved, setSaved] = useState("");

  useEffect(() => {
    let cancelled = false;
    getMyConnectCode()
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (ok && data?.code) setCode(data.code);
        else setFailed(true);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // The app's WebView cannot download: the app saves to the gallery itself, and an app too old for that asks for the update.
  const nativeSave = hasNativeStoryShare();
  const inApp = nativeSave || appTooOldFor("StoryShare");
  async function saveInApp() {
    if (!nativeSave) {
      askForAppUpdate("ذخیرهٔ عکس کد توی گالری توی نسخهٔ تازه‌ست. به‌روزش کن؛ یه دقیقه طول می‌کشه.");
      return;
    }
    try {
      await saveStoryNative(qr, "");
      setSaved("عکس کد توی گالریت ذخیره شد.");
    } catch (error) {
      setSaved(error?.code === "DENIED" ? "برای ذخیرهٔ عکس، به فرفرو اجازهٔ دسترسی به عکس‌ها رو بده." : "عکس ذخیره نشد؛ یه بار دیگه بزن.");
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="cnCodeSheet" role="dialog" aria-modal="true" aria-label="کد من برای اسکن">
      <div className="cnCodeTop">
        <b>کد من</b>
        <button type="button" className="qrScannerClose" onClick={onClose} aria-label="بستن">
          <X size={20} />
        </button>
      </div>
      <div className="cnCodeWho">
        {avatar ? <img src={avatar} alt="" /> : <span aria-hidden="true">{String(name || "؟").slice(0, 1)}</span>}
        <b>{name || "کد من"}</b>
      </div>
      <div className="cnCodeQr">
        {qr ? <img src={qr} alt="کد QR شخصی تو" /> : failed ? <p role="alert">کد باز نشد؛ دوباره بزن.</p> : <span className="ivtQrWait" role="status" aria-label="در حال آماده‌سازی"><Spinner size={44} /></span>}
      </div>
      <p className="cnCodeHint">این کد رو به سالن یا آرتیستت نشون بده. اسکنش که کنه، به هم وصل می‌شید.</p>
      {qr && inApp ? (
        <button type="button" className="cnCodeSave" onClick={saveInApp}>
          <Download size={18} aria-hidden="true" />
          عکس کد رو ذخیره کن
        </button>
      ) : qr ? (
        <a className="cnCodeSave" href={qr} download="frfro-code.png">
          <Download size={18} aria-hidden="true" />
          عکس کد رو ذخیره کن
        </a>
      ) : null}
      {saved ? <p className="cnCodeHint" role="status">{saved}</p> : null}
    </div>,
    document.body
  );
}
