"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BellRing, CalendarDays, Images, Link2, PhoneOff, Repeat, Store, Users } from "lucide-react";
import { BAZAAR_PAGE } from "../../shared/lib/appUpdate";
import { APP_DOWNLOADS_OPEN, HOME_LANDING_SKIP_KEY } from "./constants";
import { proSourceTag } from "./proSource";

/**
 * /s: the page an SMS to salon owners and artists opens. It names what frfro takes off their hands (each line is
 * something the app really does today), lets them switch between «سالن دارم» and «آرتیستم», and has one button
 * into the app. Opens, enters and Bazaar taps are counted per message tag (landing_visits, the same counter as /go).
 */
const ROLES = [
  { id: "salon", label: "سالن دارم" },
  { id: "artist", label: "آرتیستم" }
];

const POINTS = {
  salon: [
    { Icon: PhoneOff, title: "تلفن وسط کار", text: "مشتری ساعت خالیت رو می‌بینه و خودش نوبت می‌گیره. تو با یه لمس تأیید می‌کنی." },
    { Icon: BellRing, title: "یادآوری نوبت", text: "قبل از نوبت، خودش به مشتری یادآوری می‌کنه." },
    { Icon: Repeat, title: "پیگیری مشتری", text: "وقت رنگ یا ترمیم که برسه، خودش به مشتری خبر می‌ده تا دوباره نوبت بگیره." },
    { Icon: CalendarDays, title: "دفتر نوبت", text: "همهٔ نوبت‌ها توی یه تقویم. نوبت‌های تلفنی رو هم همون‌جا می‌نویسی." },
    { Icon: Users, title: "تیم سالن", text: "هر آرتیست نوبت‌های خودش رو می‌بینه." },
    { Icon: Images, title: "مشتری تازه", text: "نمونه‌کار می‌ذاری و مشتری تازه پیدات می‌کنه." }
  ],
  artist: [
    { Icon: Link2, title: "صفحهٔ خودت", text: "نمونه‌کارها و خدماتت توی یه صفحه، با یه لینک." },
    { Icon: PhoneOff, title: "نوبت بدون پیام‌بازی", text: "ساعت کاریت رو می‌چینی و مشتری خودش نوبت می‌گیره." },
    { Icon: BellRing, title: "یادآوری نوبت", text: "قبل از نوبت، خودش به مشتری یادآوری می‌کنه." },
    { Icon: Repeat, title: "پیگیری مشتری", text: "وقت ترمیم که برسه، خودش به مشتری خبر می‌ده تا دوباره نوبت بگیره." },
    { Icon: Store, title: "همکاری با سالن", text: "به تیم یه سالن می‌پیوندی و نوبت‌های اون‌جا هم به تو می‌رسه." }
  ]
};

const STEPS = ["صفحه‌ت رو بساز", "خدمات و ساعت کاری رو بچین", "لینکت رو برای مشتری بفرست"];

function beacon(source, kind) {
  try {
    const body = JSON.stringify({ source, kind });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/landing-visit", new Blob([body], { type: "application/json" }));
    else fetch("/api/landing-visit", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {}
}

export function ProScreen({ trialDays, salonPrice, artistPrice }) {
  const [role, setRole] = useState("salon");
  const [source, setSource] = useState("sms");
  const [android, setAndroid] = useState(false);

  useEffect(() => {
    const tag = proSourceTag(window.location.pathname);
    setSource(tag);
    setAndroid(/Android/i.test(navigator.userAgent || ""));
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

  const cta = `${trialDays} روز رایگان شروع کن`;

  return (
    <main className="proPage" dir="rtl">
      <section className="proPage__hero">
        <div className="proPage__glow proPage__glow--pink" aria-hidden="true" />
        <div className="proPage__glow proPage__glow--violet" aria-hidden="true" />
        <div className="proPage__brand">
          <img src="/icons/icon-192.png" alt="" width="36" height="36" />
          <span>فرفرو</span>
        </div>
        <span className="proPage__tag">برای سالن‌دار و آرتیست</span>
        <h1>
          نوبت‌هات رو
          <br />
          <em>بسپار به فرفرو</em>
        </h1>
        <p>مشتری خودش نوبت می‌گیره. تو به کارت می‌رسی.</p>
        <a className="proPage__cta" href="/" onClick={enter}>{cta}</a>
        {APP_DOWNLOADS_OPEN && android ? (
          <a className="proPage__bazaar" href={BAZAAR_PAGE} target="_blank" rel="noreferrer" onClick={() => beacon(source, "bazaar")}>
            <img src="/brand/bazaar-icon.png" alt="" width="192" height="192" />
            دریافت از کافه‌بازار
          </a>
        ) : null}
      </section>

      <section className="proPage__body">
        <div className="proPage__roles" role="tablist" aria-label="کارت چیه؟">
          {ROLES.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={role === item.id} className={role === item.id ? "is-on" : ""} onClick={() => setRole(item.id)}>
              {item.label}
            </button>
          ))}
        </div>

        <h2>چی از دوشت برمی‌داره؟</h2>
        <ul className="proPage__points">
          {POINTS[role].map(({ Icon, title, text }) => (
            <li key={title}>
              <span className="proPage__icon" aria-hidden="true"><Icon size={22} strokeWidth={2} /></span>
              <div>
                <b>{title}</b>
                <p>{text}</p>
              </div>
            </li>
          ))}
        </ul>

        <h2>سه قدم</h2>
        <ol className="proPage__steps">
          {STEPS.map((step) => <li key={step}>{step}</li>)}
        </ol>

        <p className="proPage__price">
          {trialDays} روز رایگان. بعدش {role === "salon" ? `سالن ماهی ${salonPrice}` : `آرتیست ماهی ${artistPrice}`} هزار تومن. <Link href="/pricing">قیمت‌ها</Link>
        </p>
      </section>

      <div className="proPage__bar">
        <a className="proPage__cta" href="/" onClick={enter}>{cta}</a>
      </div>
    </main>
  );
}
