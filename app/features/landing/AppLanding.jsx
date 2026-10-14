import Link from "next/link";
import QRCode from "qrcode";
import { ANDROID_APK_URL, ANDROID_APP_VERSION, DOWNLOAD_PAGE_URL } from "./constants";

/**
 * The page about frfro with the app download links. Shown at /download, and at /
 * on large screens (tablet and desktop, see HomeGate) instead of the phone app.
 * Server component: plain content, no client state.
 */

const AUDIENCES = [
  {
    image: "/role-client.png",
    title: "برای مشتری",
    points: [
      "سالن‌ها و آرتیست‌های اطراف را با نمونه‌کار واقعی ببین.",
      "از دسته‌ها شروع کن: ناخن، مو، ابرو و مژه، میکاپ، پوست و …",
      "روز و ساعت آزاد را انتخاب کن و نوبتت را بگیر.",
      "سالن خودت را با شماره یا کد QR پیدا کن و دنبالش کن."
    ]
  },
  {
    image: "/role-salon.png",
    title: "برای سالن",
    points: [
      "تقویم نوبت‌ها، تأیید و جابه‌جایی نوبت در یک صفحه.",
      "خدمات، قیمت‌ها و آرتیست‌های سالن را مرتب نگه دار.",
      "نمونه‌کارها را منتشر کن تا مشتری تازه پیدایت کند.",
      "کد QR سالن را روی میز بگذار تا مشتری‌ها با یک اسکن وصل شوند."
    ]
  },
  {
    image: "/role-artist.png",
    title: "برای آرتیست",
    points: [
      "صفحهٔ نمونه‌کار شخصی، با لینکی که می‌شود همه‌جا گذاشت.",
      "ساعت کاری خودت را بچین و نوبت مستقیم بگیر.",
      "با سالن‌ها همکاری کن و نوبت‌های سالن هم به تو برسد."
    ]
  }
];

const STEPS = [
  { image: "/brand/mascot/search.webp", title: "پیدا کن", text: "از دسته‌ها یا جست‌وجو، سالن و آرتیست مناسب را پیدا کن." },
  { image: "/brand/mascot/camera.webp", title: "ببین", text: "نمونه‌کارهای واقعی، خدمات و قیمت‌ها را قبل از رفتن ببین." },
  { image: "/brand/mascot/calendar.webp", title: "رزرو کن", text: "ساعت آزاد را انتخاب کن؛ سالن تأیید می‌کند و یادآوری می‌گیری." },
  { image: "/brand/mascot/thumbsup.webp", title: "دنبال کن", text: "سالن و آرتیست محبوبت را دنبال کن تا نمونه‌کارهای تازه‌شان را از دست ندهی." }
];

const FAQ = [
  {
    q: "چرا گوشی موقع نصب هشدار می‌دهد؟",
    a: "اندروید برای هر برنامه‌ای که از خارج از فروشگاه (مثل گوگل‌پلی یا کافه‌بازار) نصب شود هشدار نشان می‌دهد؛ این هشدار دربارهٔ خود فرفرو نیست. فایل نصبی فرفرو با کلید امضای مخصوص فرفرو امضا شده و فقط از همین سایت (frfro.ir) دانلودش کن."
  },
  {
    q: "اپ به چه چیزهایی دسترسی دارد؟",
    a: "فقط اینترنت، و اگر خودت بخواهی: دوربین (برای اسکن کد QR سالن و عکس نمونه‌کار) و موقعیت مکانی (برای پیدا کردن سالن‌های نزدیک). به مخاطبین، پیامک، تماس‌ها و فایل‌های گوشی دسترسی ندارد."
  },
  {
    q: "پرداخت داخل اپ هست؟",
    a: "نه. فرفرو فقط برای پیدا کردن و رزرو نوبت است و هیچ پولی داخل اپ جابه‌جا نمی‌شود؛ هزینه را مثل همیشه در خود سالن می‌دهی."
  },
  {
    q: "آیفون چه می‌شود؟",
    a: "نسخهٔ App Store در راه است. تا آن موقع در آیفون، سایت frfro.ir را در Safari باز کن و آن را به صفحهٔ اصلی اضافه کن؛ مثل یک اپ با آیکون خودش باز می‌شود."
  }
];

async function downloadQrSvg() {
  try {
    return await QRCode.toString(DOWNLOAD_PAGE_URL, { type: "svg", margin: 0, color: { dark: "#1c202cff", light: "#ffffff00" } });
  } catch {
    return "";
  }
}

function AndroidIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="appLanding__storeIcon">
      <path fill="currentColor" d="M17.6 9.48l1.84-3.18a.38.38 0 0 0-.66-.38l-1.86 3.22a11.4 11.4 0 0 0-9.84 0L5.22 5.92a.38.38 0 0 0-.66.38L6.4 9.48A10.8 10.8 0 0 0 1 18h22a10.8 10.8 0 0 0-5.4-8.52zM7 15.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm10 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="appLanding__storeIcon">
      <path fill="currentColor" d="M16.37 12.7c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.82-.81-3-.79a4.44 4.44 0 0 0-3.75 2.28c-1.6 2.78-.41 6.89 1.15 9.14.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23a9.7 9.7 0 0 0 1.25-2.57 3.98 3.98 0 0 1-2.38-3.68zM14.1 5.94c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.61-2.66 1.37-.58.67-1.1 1.76-.96 2.8 1.01.08 2.05-.52 2.68-1.28z" />
    </svg>
  );
}

function DownloadButtons() {
  return (
    <div className="appLanding__buttons">
      <a className="appLanding__store is-primary" href={ANDROID_APK_URL} download="frfro.apk">
        <AndroidIcon />
        <span>
          <small>دانلود مستقیم برای</small>
          اندروید
        </span>
      </a>
      <a className="appLanding__store" href="#iphone">
        <AppleIcon />
        <span>
          <small>نصب روی</small>
          آیفون
        </span>
      </a>
    </div>
  );
}

export async function AppLanding({ showOpenSite = false }) {
  const qrSvg = await downloadQrSvg();
  return (
    <main className="appLanding" dir="rtl">
      <header className="appLanding__nav">
        <Link href="/download" className="appLanding__brand" aria-label="frfro">
          <img src="/icons/icon-192.png" alt="" width="40" height="40" />
          <span>فرفرو</span>
        </Link>
        <nav>
          <a href="#about">فرفرو چیست</a>
          <a href="#how">چطور کار می‌کند</a>
          <a href="#install">نصب</a>
          <a href="#faq">سؤال‌ها</a>
        </nav>
      </header>

      <section className="appLanding__hero">
        <div className="appLanding__heroText">
          <p className="appLanding__eyebrow">شبکهٔ اجتماعی زیبایی بانوان</p>
          <h1>سالن و آرتیست زیبایی‌ات را پیدا کن، نمونه‌کار واقعی ببین و نوبت بگیر.</h1>
          <p className="appLanding__lead">
            فرفرو مشتری، سالن و آرتیست را در یک جا کنار هم می‌آورد: کشف با نمونه‌کار واقعی، رزرو مستقیم و برنامهٔ کاری مرتب. بدون تماس‌های پشت سر هم و بدون دفترچه.
          </p>
          <DownloadButtons />
          <p className="appLanding__note">نسخهٔ اندروید {ANDROID_APP_VERSION} · رایگان · بدون پرداخت داخل برنامه</p>
        </div>
        <div className="appLanding__heroArt" aria-hidden="true">
          <div className="appLanding__phone">
            <img src="/explore-collage.webp" alt="" />
          </div>
          {qrSvg ? (
            <div className="appLanding__qr">
              <div className="appLanding__qrCode" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              <span>با دوربین گوشی اسکن کن و اپ را بگیر</span>
            </div>
          ) : null}
        </div>
      </section>

      <section id="about" className="appLanding__section">
        <h2>یک اپ، برای هر سه طرف</h2>
        <div className="appLanding__cards">
          {AUDIENCES.map((audience) => (
            <article key={audience.title} className="appLanding__card">
              <img src={audience.image} alt="" width="72" height="72" />
              <h3>{audience.title}</h3>
              <ul>
                {audience.points.map((point) => <li key={point}>{point}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section id="how" className="appLanding__section">
        <h2>چطور کار می‌کند</h2>
        <ol className="appLanding__steps">
          {STEPS.map((step) => (
            <li key={step.title}>
              <img src={step.image} alt="" width="64" height="64" />
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="install" className="appLanding__section">
        <h2>نصب فرفرو</h2>
        <div className="appLanding__install">
          <article className="appLanding__card">
            <h3><AndroidIcon /> اندروید</h3>
            <ol>
              <li>دکمهٔ «دانلود مستقیم برای اندروید» را بزن.</li>
              <li>بعد از دانلود، فایل <bdi>frfro.apk</bdi> را از اعلان دانلود یا برنامهٔ «فایل‌ها» باز کن.</li>
              <li>اگر گوشی پرسید، اجازهٔ «نصب برنامه‌های ناشناس» را برای همان برنامه بده و دوباره فایل را باز کن.</li>
              <li>«نصب» را بزن. اگر Play Protect پرسید، «جزئیات بیشتر» و بعد «در هر صورت نصب شود».</li>
            </ol>
            <a className="appLanding__store is-primary is-small" href={ANDROID_APK_URL} download="frfro.apk">
              <AndroidIcon />
              <span>دانلود فایل نصبی</span>
            </a>
          </article>
          <article id="iphone" className="appLanding__card">
            <h3><AppleIcon /> آیفون</h3>
            <ol>
              <li>سایت <bdi>frfro.ir</bdi> را در مرورگر Safari باز کن.</li>
              <li>دکمهٔ اشتراک‌گذاری (مربع با فلش رو به بالا) را بزن.</li>
              <li>«Add to Home Screen» یا «افزودن به صفحهٔ اصلی» را انتخاب کن.</li>
              <li>از این به بعد فرفرو با آیکون خودش، تمام‌صفحه و مثل یک اپ باز می‌شود.</li>
            </ol>
            <p className="appLanding__soon">نسخهٔ App Store به‌زودی.</p>
          </article>
        </div>
      </section>

      <section id="faq" className="appLanding__section">
        <h2>سؤال‌های رایج</h2>
        <div className="appLanding__faq">
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="appLanding__footer">
        <div>
          <strong>فرفرو</strong>
          <span>پشتیبانی: <a href="mailto:support@frfro.ir">support@frfro.ir</a></span>
        </div>
        <nav>
          <Link href="/terms">قوانین و مقررات</Link>
          <Link href="/privacy">حریم خصوصی</Link>
          {showOpenSite ? <Link href="/">ورود به فرفرو</Link> : null}
        </nav>
      </footer>
    </main>
  );
}
