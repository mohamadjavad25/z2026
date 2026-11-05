"use client";

import { useEffect, useState } from "react";
import { BAZAAR_PAGE } from "../../shared/lib/appUpdate";
import { ANDROID_APK_URL, APP_DOWNLOADS_OPEN, DOWNLOAD_PAGE_URL, HOME_LANDING_SKIP_KEY } from "./constants";

/**
 * /go: where the Instagram reel and bio link lead. A visitor is almost always inside Instagram's own browser, which
 * cannot save an APK and has no «افزودن به صفحهٔ اصلی». So the one big button just opens frfro in this same browser
 * (the web app works there). On Android a second button goes to Cafe Bazaar, also inside Instagram because that is only
 * a link; the Android file is offered only in a real browser. An iPhone inside Instagram gets a short «open in Safari»
 * hint with a copy button. Opens, enters, Bazaar and download taps are counted (landing_visits).
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
          نمونه‌کار ببین،
          <br />
          <em>نوبت بگیر</em>
        </h1>
        <p>سالن و آرتیست رو با نمونه‌کار واقعی ببین و همون‌جا نوبت بگیر. برای مشتری رایگانه.</p>
        <a className="goPage__enter" href="/" onClick={enter}>ورود به فرفرو</a>
        {APP_DOWNLOADS_OPEN && android ? (
          <a className="goPage__bazaar" href={BAZAAR_PAGE} target="_blank" rel="noreferrer" onClick={() => beacon(source, "bazaar")}>
            <img src="/brand/bazaar-icon.png" alt="" width="192" height="192" />
            دریافت از کافه‌بازار
          </a>
        ) : null}
        {APP_DOWNLOADS_OPEN && android && !inApp ? (
          <a className="goPage__apk" href={ANDROID_APK_URL} download="frfro.apk" onClick={() => beacon(source, "apk")}>
            بازار نداری؟ فایل نصبی رو مستقیم بگیر
          </a>
        ) : null}
        {inApp && !android ? (
          <div className="goPage__hint">
            <p>برای نصب اپ، این لینک رو توی Safari باز کن.</p>
            <button type="button" onClick={copy}>{copied ? "کپی شد" : "کپی لینک"}</button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
