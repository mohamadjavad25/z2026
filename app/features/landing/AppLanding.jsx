import Link from "next/link";
import QRCode from "qrcode";
import { Check, Palette, Search, Store } from "lucide-react";
import { BAZAAR_PAGE } from "../../shared/lib/appUpdate";
import { ANDROID_APK_URL, APP_DOWNLOADS_OPEN, DOWNLOAD_PAGE_URL } from "./constants";
import { EnterAppButton } from "./EnterAppButton";
import { HeroMotion } from "./HeroMotion";
import { ScanToOpen } from "./ScanToOpen";
import { ServiceIcon } from "../../components/ServiceIcon";

/**
 * The page about frfro with the app download links: Cafe Bazaar first (it holds the current build and updates it),
 * the same file straight from this site for phones without Bazaar. Shown at /download, at "/" on phones
 * until the visitor taps «ورود به فرفرو», and on large screens (tablet and desktop) in place
 * of every page but /admin, /terms and /privacy (see LargeScreenGate).
 * Server component: plain content. The hero picture (HeroMotion) and all other motion are CSS.
 * While APP_DOWNLOADS_OPEN is off it is shown on large screens only, with «به‌زودی» in place of every
 * download link, and the install section explains adding the site to the home screen instead.
 * The «آموزش» tutorials player (LearnSection) is built but hidden for now (user's decision 2026-10-15).
 * Look: white and ink with pink and violet blended in (see the tokens at the top of landing.css).
 */

const CATEGORIES = [
  { icon: "manicure", label: "ناخن" },
  { icon: "highlights", label: "مو" },
  { icon: "eyebrow", label: "ابرو و مژه" },
  { icon: "lipstick", label: "میکاپ" },
  { icon: "blowdry", label: "براشینگ" },
  { icon: "haircut", label: "کوتاهی" },
  { icon: "bridal", label: "میکاپ عروس" },
  { icon: "facial", label: "پوست" }
];

const AUDIENCES = [
  {
    Icon: Search,
    tag: "مشتری",
    title: "دنبال سالن خوبی؟",
    points: [
      "نمونه‌کار واقعی ببین.",
      "ساعت آزاد رو انتخاب کن.",
      "با یه اسکن به سالنت وصل شو."
    ]
  },
  {
    Icon: Store,
    tag: "سالن",
    title: "سالن داری؟",
    points: [
      "نوبت‌ها یه‌جا، تأیید با یه لمس.",
      "نمونه‌کار بذار تا مشتری تازه پیدات کنه.",
      "کد QR رو روی میز بذار."
    ]
  },
  {
    Icon: Palette,
    tag: "آرتیست",
    title: "آرتیست هستی؟",
    points: [
      "صفحهٔ نمونه‌کار خودت، با یه لینک.",
      "ساعت کاریت رو بچین و نوبت بگیر.",
      "با سالن‌ها همکاری کن."
    ]
  }
];

const STEPS = [
  { image: "/brand/mascot/find.webp", title: "پیدا کن", text: "سالن و آرتیست رو جست‌وجو کن." },
  { image: "/brand/mascot/no-portfolio.webp", title: "ببین", text: "نمونه‌کار و قیمت‌ها رو قبل از رفتن ببین." },
  { image: "/brand/mascot/booked.webp", title: "نوبت بگیر", text: "ساعت آزاد رو بگیر؛ یادآوری برات میاد." },
  { image: "/brand/mascot/connect.webp", title: "وصل شو", text: "به سالن محبوبت وصل شو و خبرهاش رو ببین." }
];

const PROMISES = [
  { title: "رایگان", text: "برای مشتری همیشه رایگانه." },
  { title: "بدون پرداخت در اپ", text: "هزینه رو توی سالن می‌دی." },
  { title: "دسترسی کم", text: "دوربین و موقعیت فقط با اجازهٔ تو." }
];

const DOWNLOAD_FAQ = [
  {
    q: "بازار ندارم، چی کار کنم؟",
    a: "فایل نصبی رو از همین صفحه بگیر. موقع نصب، گوشی هشدار می‌ده؛ برای هر برنامه‌ای که بیرون از فروشگاه نصب بشه همینه."
  },
];

const SHARED_FAQ = [
  {
    q: "اپ به چی دسترسی داره؟",
    a: "فقط با اجازهٔ تو: دوربین، موقعیت و اعلان. به مخاطبین، پیامک و فایل‌هات دسترسی نداره."
  },
  {
    q: "پرداخت داخل اپ هست؟",
    a: "برای مشتری نه. هزینهٔ خدمت رو توی سالن می‌دی."
  }
];

const IPHONE_FAQ = {
  q: "آیفون چی؟",
  a: "نسخهٔ App Store در راهه. فعلاً توی Safari باز کن و «افزودن به صفحهٔ اصلی» رو بزن."
};

const SOON_FAQ = {
  q: "اپلیکیشن کی میاد؟",
  a: "به‌زودی. تا اون موقع frfro.ir رو توی مرورگر گوشی باز کن و به صفحهٔ اصلی اضافه‌ش کن."
};

const FAQ = APP_DOWNLOADS_OPEN ? [...DOWNLOAD_FAQ, ...SHARED_FAQ, IPHONE_FAQ] : [SOON_FAQ, ...SHARED_FAQ];

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

function BazaarIcon() {
  return (
    <span className="appLanding__bazaarIcon" aria-hidden="true">
      <img src="/brand/bazaar-icon.png" alt="" width="192" height="192" />
    </span>
  );
}

function BazaarButton({ small = false }) {
  return (
    <a className={`appLanding__store is-primary${small ? " is-small" : ""}`} href={BAZAAR_PAGE} target="_blank" rel="noreferrer">
      <BazaarIcon />
      <span>
        <small>دریافت از</small>
        کافه‌بازار
      </span>
    </a>
  );
}

function DirectDownload() {
  return (
    <a className="appLanding__direct" href={ANDROID_APK_URL} download="frfro.apk">
      بازار نداری؟ فایل نصبی رو مستقیم بگیر
    </a>
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
  if (!APP_DOWNLOADS_OPEN) {
    return (
      <div className={`appLanding__appSoon is-${tone}`}>
        <strong>اپلیکیشن فرفرو به‌زودی</strong>
        <span>تا اون موقع فرفرو رو توی مرورگر گوشی باز کن.</span>
      </div>
    );
  }
  return (
    <div className={`appLanding__buttons is-${tone}`}>
      <BazaarButton />
      <a className="appLanding__store" href="#iphone">
        <AppleIcon />
        <span>
          <small>نصب روی</small>
          آیفون
        </span>
      </a>
      <DirectDownload />
    </div>
  );
}

function CategoryRibbon() {
  const row = (hidden) => (
    <ul className="appLanding__ribbonRow" aria-hidden={hidden || undefined}>
      {CATEGORIES.map((category) => (
        <li key={category.label}>
          <ServiceIcon emoji={category.icon} size="sm" />
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
        <Link href="/download" className="appLanding__brand" aria-label="فرفرو (frfro)">
          <img src="/icons/icon-192.png" alt="" width="36" height="36" />
          <span>فرفرو</span>
        </Link>
        <nav aria-label="بخش‌های صفحه">
          <a href="#about">فرفرو چیه</a>
          <a href="#how">چطور کار می‌کنه</a>
          <a href="#install">نصب</a>
          <a href="#faq">سؤال‌ها</a>
        </nav>
        {APP_DOWNLOADS_OPEN ? (
          <a className="appLanding__navCta" href={BAZAAR_PAGE} target="_blank" rel="noreferrer">دانلود اپ</a>
        ) : (
          <span className="appLanding__navCta is-soon">اپ به‌زودی</span>
        )}
      </header>

      <section className="appLanding__hero">
        <div className="appLanding__aurora" aria-hidden="true" />
        <div className="appLanding__heroInner">
          <div className="appLanding__heroText">
            <h1>
              نمونه‌کار ببین،
              <br />
              <em>نوبت بگیر</em>
            </h1>
            <p className="appLanding__lead">
              سالن و آرتیست رو با نمونه‌کار واقعی ببین و همون‌جا نوبت بگیر.
            </p>
            <ScanToOpen />
            <DownloadButtons />
            <EnterAppButton className="appLanding__enter">یا ورود به فرفرو در مرورگر ←</EnterAppButton>
            <p className="appLanding__note">برای مشتری رایگانه</p>
          </div>

          <div className="appLanding__heroArt">
            <HeroMotion />
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
            <p className="appLanding__kicker">فرفرو چیه</p>
            <h2>یه اپ، برای <em>هر سه طرف</em></h2>
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
            <p className="appLanding__kicker">چطور کار می‌کنه</p>
            <h2>چهار قدم تا <em>صندلی سالن</em></h2>
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
            <h2>فرفرو رو بیار روی گوشیت</h2>
            {APP_DOWNLOADS_OPEN ? null : <p>اپلیکیشن به‌زودی میاد. تا اون موقع فرفرو رو به صفحهٔ اصلی گوشی اضافه کن.</p>}
          </header>
          <div className="appLanding__install">
            {APP_DOWNLOADS_OPEN ? (
              <article className="appLanding__guide appLanding__reveal">
                <h3><AndroidIcon /> اندروید</h3>
                <ol>
                  <li>دکمهٔ کافه‌بازار رو بزن.</li>
                  <li>توی بازار «نصب» رو بزن.</li>
                  <li>فرفرو رو باز کن و وارد شو.</li>
                </ol>
                <BazaarButton small />
                <DirectDownload />
              </article>
            ) : (
              <article className="appLanding__guide appLanding__reveal">
                <h3><AndroidIcon /> اندروید</h3>
                <ol>
                  <li><bdi>frfro.ir</bdi> رو توی Chrome باز کن.</li>
                  <li>منوی سه‌نقطهٔ بالای صفحه رو بزن.</li>
                  <li>«افزودن به صفحهٔ اصلی» یا «نصب برنامه» رو بزن.</li>
                  <li>حالا فرفرو مثل یه اپ باز می‌شه.</li>
                </ol>
                <p className="appLanding__soon">اپ اندروید به‌زودی.</p>
              </article>
            )}
            <article id="iphone" className="appLanding__guide appLanding__reveal">
              <h3><AppleIcon /> آیفون</h3>
              <ol>
                <li><bdi>frfro.ir</bdi> رو توی Safari باز کن.</li>
                <li>دکمهٔ اشتراک‌گذاری رو بزن.</li>
                <li>«افزودن به صفحهٔ اصلی» رو بزن.</li>
                <li>حالا فرفرو مثل یه اپ باز می‌شه.</li>
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
          <img className="appLanding__finaleMascot" src="/brand/mascot/done.webp" alt="" width="641" height="640" loading="lazy" />
          <div>
            <h2>نوبت بعدیت رو با فرفرو بگیر.</h2>
            <DownloadButtons tone="dark" />
            <EnterAppButton className="appLanding__enter">یا ورود به فرفرو در مرورگر ←</EnterAppButton>
          </div>
        </div>
      </section>

      <footer className="appLanding__footer">
        <div className="appLanding__footerInner">
          <div>
            <strong>فرفرو <bdi>frfro</bdi></strong>
            <span>پشتیبانی: <a href="mailto:frfrosupport@gmail.com">frfrosupport@gmail.com</a> · <a href="tel:+989030143721">۰۹۰۳۰۱۴۳۷۲۱</a></span>
          </div>
          <nav aria-label="پیوندهای پایین صفحه">
            <Link href="/pricing">قیمت‌ها</Link>
            <Link href="/terms">قوانین و مقررات</Link>
            <Link href="/privacy">حریم خصوصی</Link>
            <EnterAppButton className="appLanding__enterLink">ورود به فرفرو</EnterAppButton>
          </nav>
          {/* eNamad badge: their code, unchanged (changing it is not allowed). */}
          <a className="appLanding__trust" referrerPolicy="origin" target="_blank" href="https://trustseal.enamad.ir/?id=8439818&Code=kdrswMfJscYMIJmUvV60S2sy3F2rXOEA">
            <img referrerPolicy="origin" src="https://trustseal.enamad.ir/logo.aspx?id=8439818&Code=kdrswMfJscYMIJmUvV60S2sy3F2rXOEA" alt="" style={{ cursor: "pointer" }} code="kdrswMfJscYMIJmUvV60S2sy3F2rXOEA" />
          </a>
        </div>
      </footer>
    </main>
  );
}
