"use client";

import { useEffect, useState } from "react";
import { ANDROID_APK_URL, APP_DOWNLOADS_OPEN, DOWNLOAD_PAGE_URL, HOME_LANDING_SKIP_KEY } from "./constants";

/**
 * /go: where the Instagram reel and bio link lead. A visitor is almost always inside Instagram's own browser, which
 * cannot save an APK and has no «افزودن به صفحهٔ اصلی». So the one big button just opens frfro in this same browser
 * (the web app works there); a quiet second line offers the Android file only in a real browser, and inside Instagram
 * a short «open in Chrome» hint with a copy button. Opens, enters and download taps are counted (landing_visits).
 */
function beacon(source, kind) {
  try {
    const body = JSON.stringify({ source, kind });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/landing-visit", new Blob([body], { type: "application/json" }));
    else fetch("/api/landing-visit", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {}
}

export function GoScreen() {
  const [source, setSource] = useState("go");
  const [inApp, setInApp] = useState(false);
  const [android, setAndroid] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    const tag = (new URLSearchParams(window.location.search).get("s") || "go").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24) || "go";
    setSource(tag);
    setInApp(/Instagram|FBAN|FBAV/i.test(ua));
    setAndroid(/Android/i.test(ua));
    beacon(tag, "open");
  }, []);

  function enter(event) {
    event.preventDefault();
    beacon(source, "enter");
    try {
      localStorage.setItem(HOME_LANDING_SKIP_KEY, "1");
    } catch {}
    window.location.assign("/");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(DOWNLOAD_PAGE_URL);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="goPage" dir="rtl">
      <div className="goPage__glow goPage__glow--pink" aria-hidden="true" />
      <div className="goPage__glow goPage__glow--violet" aria-hidden="true" />
      <div className="goPage__sheet goPage__sheet--back" aria-hidden="true" />
      <div className="goPage__sheet goPage__sheet--mid" aria-hidden="true" />
      <section className="goPage__card">
        <img className="goPage__mascot" src="/brand/mascot/done.webp" alt="" width="160" height="160" />
        <h1>
          رزرو کن،
          <br />
          <em>بدرخش</em>
        </h1>
        <p>سالن و آرتیست رو با نمونه‌کار واقعی ببین و همون‌جا نوبت بگیر. برای مشتری رایگانه.</p>
        <a className="goPage__enter" href="/" onClick={enter}>ورود به فرفرو</a>
        {inApp ? (
          <div className="goPage__hint">
            <p>برای نصب اپ، این لینک رو توی Chrome یا Safari باز کن.</p>
            <button type="button" onClick={copy}>{copied ? "کپی شد" : "کپی لینک"}</button>
          </div>
        ) : APP_DOWNLOADS_OPEN && android ? (
          <a className="goPage__apk" href={ANDROID_APK_URL} download="frfro.apk" onClick={() => beacon(source, "apk")}>
            یا دانلود اپ اندروید
          </a>
        ) : null}
      </section>
    </main>
  );
}
