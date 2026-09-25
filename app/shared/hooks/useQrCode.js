"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Base64 PNG data URL for `url`, or "" while pending/empty/failed. */
export function useQrCode(url, active = true) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    if (!active || !url) {
      setDataUrl("");
      return undefined;
    }
    let cancelled = false;
    QRCode.toDataURL(url, {
      width: 320,
      margin: 3,
      errorCorrectionLevel: "M",
      color: { dark: "#1c202c", light: "#ffffff" }
    })
      .then((result) => { if (!cancelled) setDataUrl(result); })
      .catch(() => { if (!cancelled) setDataUrl(""); });
    return () => { cancelled = true; };
  }, [active, url]);

  return dataUrl;
}
