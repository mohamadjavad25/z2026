import Link from "next/link";
import QRCode from "qrcode";
import { Check, Palette, Search, Store } from "lucide-react";
import { ANDROID_APK_URL, ANDROID_APP_VERSION, DOWNLOAD_PAGE_URL } from "./constants";
import { EnterAppButton } from "./EnterAppButton";

/**
 * The page about frfro with the app download links. Shown at /download, at "/" on phones
 * until the visitor taps «ورود به فرفرو», and on large screens (tablet and desktop) in place
 * of every page but /admin, /terms and /privacy (see LargeScreenGate).
 * Server component: plain content, no client state. Motion is CSS only (landing.css).
 * Look: white and ink with pink and violet blended in (see the tokens at the top of landing.css).
 */

const CATEGORIES = [
  { image: "/brand/mascot/nails.webp", label: "ناخن" },
  { image: "/brand/mascot/hairstyle.webp", label: "مو" },
  { image: "/brand/mascot/mirror.webp", label: "ابرو و مژه" },
  { image: "/brand/mascot/makeup.webp", label: "میکاپ" },
  { image: "/brand/mascot/hairdryer.webp", label: "براشینگ" },
  { image: "/brand/mascot/scissors.webp", label: "کوتاهی" },
  { image: "/brand/mascot/party.webp", label: "میکاپ عروس" },
  { image: "/brand/mascot/camera.webp", label: "پوست" }
];

const AUDIENCES = [
  {
    Icon: Search,
    tag: "مشتری",
    title: "دنبال سالن خوبی؟",
    points: [
      "سالن‌ها و آرتیست‌های اطراف را با نمونه‌کار واقعی ببین.",
      "از دسته‌ها شروع کن: ناخن، مو، ابرو و مژه، میکاپ، پوست و …",
      "روز و ساعت آزاد را انتخاب کن و نوبتت را بگیر.",
      "سالن خودت را با شماره یا کد QR پیدا کن و دنبالش کن."
    ]
  },
  {
    Icon: Store,
    tag: "سالن",
    title: "سالن داری؟",
    points: [
      "تقویم نوبت‌ها، تأیید و جابه‌جایی نوبت در یک صفحه.",
      "خدمات، قیمت‌ها و آرتیست‌های سالن را مرتب نگه دار.",
      "نمونه‌کارها را منتشر کن تا مشتری تازه پیدایت کند.",
      "کد QR سالن را روی میز بگذار تا مشتری‌ها با یک اسکن وصل شوند."
    ]
  },
  {
    Icon: Palette,
    tag: "آرتیست",
    title: "آرتیست هستی؟",
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

const PROMISES = [
  { title: "رایگان", text: "نصب و استفاده برای مشتری هزینه‌ای ندارد." },
  { title: "بدون پرداخت در اپ", text: "هیچ پولی داخل اپ جابه‌جا نمی‌شود؛ هزینه را در خود سالن می‌دهی." },
  { title: "دسترسی کم", text: "نه مخاطبین، نه پیامک، نه فایل‌ها. دوربین و موقعیت فقط اگر خودت بخواهی." }
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
    return await QRCode.toString(DOWNLOAD_PAGE_URL, { type: "svg", margin: 0, color: { dark: "#0c0d12ff", light: "#ffffff00" } });
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

function DownloadButtons({ tone = "light" }) {
  return (
    <div className={`appLanding__buttons is-${tone}`}>
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

function CategoryRibbon() {
  const row = (hidden) => (
    <ul className="appLanding__ribbonRow" aria-hidden={hidden || undefined}>
      {CATEGORIES.map((category) => (
        <li key={category.label}>
          <img src={category.image} alt="" width="40" height="40" loading="lazy" />
          {category.label}
        </li>
      ))}
    </ul>
  );
  return (
    <div className="appLanding__ribbon">
      <div className="appLanding__ribbonTrack">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}

export async function AppLanding() {
  const qrSvg = await downloadQrSvg();
  return (
    <main className="appLanding" dir="rtl">
      <header className="appLanding__nav">
        <Link href="/download" className="appLanding__brand" aria-label="frfro">
          <img src="/icons/icon-192.png" alt="" width="36" height="36" />
          <span>فرفرو</span>
        </Link>
        <nav aria-label="بخش‌های صفحه">
          <a href="#about">فرفرو چیست</a>
          <a href="#how">چطور کار می‌کند</a>
          <a href="#install">نصب</a>
          <a href="#faq">سؤال‌ها</a>
        </nav>
        <a className="appLanding__navCta" href={ANDROID_APK_URL} download="frfro.apk">دانلود اپ</a>
      </header>

      <section className="appLanding__hero">
        <div className="appLanding__aurora" aria-hidden="true" />
        <div className="appLanding__heroInner">
          <div className="appLanding__heroText">
            <p className="appLanding__eyebrow"><span aria-hidden="true" /> شبکهٔ اجتماعی زیبایی بانوان</p>
            <h1>
              زیبایی‌ات،
              <br />
              <em>یک نوبت</em> فاصله دارد.
            </h1>
            <p className="appLanding__lead">
              سالن و آرتیست زیبایی‌ات را پیدا کن، نمونه‌کار واقعی ببین و همان‌جا نوبت بگیر. بدون تماس‌های پشت سر هم و بدون دفترچه.
            </p>
            <DownloadButtons />
            <EnterAppButton className="appLanding__enter">یا ورود به فرفرو در مرورگر ←</EnterAppButton>
            <p className="appLanding__note">نسخهٔ اندروید {ANDROID_APP_VERSION} · رایگان · بدون پرداخت داخل برنامه</p>
          </div>

          <div className="appLanding__heroArt" aria-hidden="true">
            <div className="appLanding__phone">
              <img src="/explore-collage.webp" alt="" />
            </div>
            <div className="appLanding__float is-confirm">
              <span className="appLanding__floatIcon"><Check size={18} strokeWidth={3} /></span>
              <span>
                <strong>نوبتت تأیید شد</strong>
                <small>فردا · ساعت ۱۶:۳۰</small>
              </span>
            </div>
            <div className="appLanding__float is-times">
              <strong>ساعت‌های آزاد امروز</strong>
              <span className="appLanding__times"><b>۱۴:۰۰</b><b>۱۵:۳۰</b><b>۱۷:۰۰</b></span>
            </div>
            <img className="appLanding__heroMascot" src="/brand/mascot/search.webp" alt="" width="415" height="640" />
            {qrSvg ? (
              <div className="appLanding__qr">
                <div className="appLanding__qrCode" dangerouslySetInnerHTML={{ __html: qrSvg }} />
                <span>با دوربین گوشی اسکن کن</span>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <CategoryRibbon />

      <section id="about" className="appLanding__dark">
        <div className="appLanding__section">
          <header className="appLanding__head appLanding__reveal">
            <p className="appLanding__kicker">فرفرو چیست</p>
            <h2>یک اپ، برای <em>هر سه طرف</em></h2>
            <p>فرفرو مشتری، سالن و آرتیست را در یک جا کنار هم می‌آورد: کشف با نمونه‌کار واقعی، رزرو مستقیم و برنامهٔ کاری مرتب.</p>
          </header>
          <div className="appLanding__cards">
            {AUDIENCES.map((audience, index) => (
              <article key={audience.tag} className={`appLanding__card is-${index} appLanding__reveal`}>
                <div className="appLanding__cardTop">
                  <span className="appLanding__tag">برای {audience.tag}</span>
                  <span className="appLanding__cardIcon"><audience.Icon size={26} strokeWidth={2} aria-hidden="true" /></span>
                </div>
                <h3>{audience.title}</h3>
                <ul>
                  {audience.points.map((point) => <li key={point}>{point}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="appLanding__light">
        <div className="appLanding__section">
          <header className="appLanding__head appLanding__reveal">
            <p className="appLanding__kicker">چطور کار می‌کند</p>
            <h2>از دیدن تا نشستن روی صندلی سالن، در <em>چهار قدم</em></h2>
          </header>
          <ol className="appLanding__steps">
            {STEPS.map((step) => (
              <li key={step.title} className="appLanding__reveal">
                <div className="appLanding__stepArt">
                  <img src={step.image} alt="" width="415" height="640" loading="lazy" />
                </div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="appLanding__promises appLanding__reveal" aria-label="قول‌های فرفرو">
        {PROMISES.map((promise) => (
          <div key={promise.title}>
            <span className="appLanding__promiseIcon"><Check size={18} strokeWidth={3} aria-hidden="true" /></span>
            <strong>{promise.title}</strong>
            <span>{promise.text}</span>
          </div>
        ))}
      </section>

      <section id="install" className="appLanding__light is-mist">
        <div className="appLanding__section">
          <header className="appLanding__head appLanding__reveal">
            <p className="appLanding__kicker">نصب</p>
            <h2>فرفرو را روی گوشی‌ات بیاور</h2>
          </header>
          <div className="appLanding__install">
            <article className="appLanding__guide appLanding__reveal">
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
            <article id="iphone" className="appLanding__guide appLanding__reveal">
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
        </div>
      </section>

      <section id="faq" className="appLanding__light">
        <div className="appLanding__section is-narrow">
          <header className="appLanding__head appLanding__reveal">
            <p className="appLanding__kicker">سؤال‌ها</p>
            <h2>سؤال‌های رایج</h2>
          </header>
          <div className="appLanding__faq">
            {FAQ.map((item) => (
              <details key={item.q} className="appLanding__reveal">
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="appLanding__finaleWrap">
        <div className="appLanding__finale appLanding__reveal">
          <img className="appLanding__finaleMascot" src="/brand/mascot/thumbsup.webp" alt="" width="460" height="640" loading="lazy" />
          <div>
            <h2>نوبت بعدی‌ات را با فرفرو بگیر.</h2>
            <p>رایگان، سبک و بدون پرداخت داخل برنامه.</p>
            <DownloadButtons tone="dark" />
            <EnterAppButton className="appLanding__enter">یا ورود به فرفرو در مرورگر ←</EnterAppButton>
          </div>
        </div>
      </section>

      <footer className="appLanding__footer">
        <div className="appLanding__footerInner">
          <div>
            <strong>فرفرو</strong>
            <span>پشتیبانی: <a href="mailto:support@frfro.ir">support@frfro.ir</a></span>
          </div>
          <nav aria-label="پیوندهای پایین صفحه">
            <Link href="/terms">قوانین و مقررات</Link>
            <Link href="/privacy">حریم خصوصی</Link>
            <EnterAppButton className="appLanding__enterLink">ورود به فرفرو</EnterAppButton>
          </nav>
        </div>
      </footer>
    </main>
  );
}
