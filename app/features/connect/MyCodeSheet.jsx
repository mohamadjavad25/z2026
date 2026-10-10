"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, X } from "lucide-react";
import { getMyConnectCode } from "../../shared/api/connections";
import { useQrCode } from "../../shared/hooks/useQrCode";

/**
 * «اسکن شو»: the client's personal QR. A salon or artist scans it (from their
 * customers page) to add the client; both then appear in each other's lists.
 */
export function MyCodeSheet({ name = "", avatar = "", onClose }) {
  const [code, setCode] = useState("");
  const [failed, setFailed] = useState(false);
  const qr = useQrCode(code, Boolean(code));

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

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="cnCodeSheet" role="dialog" aria-modal="true" aria-label="کد من برای اسکن">
      <div className="cnCodeTop">
        <b>اسکن شو</b>
        <button type="button" className="qrScannerClose" onClick={onClose} aria-label="بستن">
          <X size={20} />
        </button>
      </div>
      <div className="cnCodeWho">
        {avatar ? <img src={avatar} alt="" /> : <span aria-hidden="true">{String(name || "؟").slice(0, 1)}</span>}
        <b>{name || "کد من"}</b>
      </div>
      <div className="cnCodeQr">
        {qr ? <img src={qr} alt="کد QR شخصی تو" /> : failed ? <p role="alert">کد باز نشد؛ دوباره امتحان کن.</p> : <span className="ivtQrWait" aria-label="در حال آماده‌سازی" />}
      </div>
      <p className="cnCodeHint">این کد را به سالن یا آرتیستت نشان بده. با اسکن آن، تو را به مشتری‌هایش اضافه می‌کند و او هم به لیست تو اضافه می‌شود.</p>
      {qr ? (
        <a className="cnCodeSave" href={qr} download="frfro-code.png">
          <Download size={18} aria-hidden="true" />
          ذخیره تصویر کد
        </a>
      ) : null}
    </div>,
    document.body
  );
}
