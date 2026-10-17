"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useQrCode } from "../../shared/hooks/useQrCode";

/**
 * Shown on tablets and desktops only (landing.css): the app is not usable on a large screen,
 * so the visitor scans this code with a phone. The code holds the address of the page the
 * visitor came to (a salon, an artist, a post…), so the phone opens that same page.
 */
export function ScanToOpen() {
  const pathname = usePathname() || "/";
  const [target, setTarget] = useState("");

  useEffect(() => {
    const { origin, search, hash } = window.location;
    setTarget(`${origin}${pathname}${search}${hash}`);
  }, [pathname]);

  const qr = useQrCode(target, Boolean(target));

  return (
    <section className="appLanding__scan" aria-label="باز کردن فرفرو با گوشی">
      <div className="appLanding__scanCode">
        {qr ? <img src={qr} alt="کد QR برای باز کردن فرفرو روی گوشی" width="320" height="320" /> : null}
      </div>
      <div className="appLanding__scanText">
        <strong>فرفرو را با گوشی باز کن</strong>
        <span>فرفرو برای گوشی ساخته شده. دوربین گوشی‌ات را روی این کد بگیر تا همین صفحه روی گوشی باز شود.</span>
      </div>
    </section>
  );
}
