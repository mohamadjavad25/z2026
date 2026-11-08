#!/usr/bin/env node
/**
 * Store pictures (1080×1920): a headline over a phone with one raw picture from shots.mjs (scripts/store/README.md).
 *
 *   STORE_OUT=<folder of raw pictures> node scripts/store/compose.mjs    # writes <folder>/final/1.png … 7.png
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const RAW = process.env.STORE_OUT || path.resolve("store-shots");
const FINAL = path.join(RAW, "final");
const asset = (rel) => pathToFileURL(path.resolve(new URL(`../../${rel}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))).href;
const raw = (name) => pathToFileURL(path.join(RAW, `${name}.png`)).href;

// Words follow docs/COPY.md: casual «تو», «رو».
export const PAGES = [
  { n: 1, shot: "salon", title: "نمونه‌کار واقعی ببین", sub: "قبل از رفتن، کار سالن و قیمت‌ها رو ببین" },
  { n: 2, shot: "time", title: "ساعت خالی رو انتخاب کن", sub: "نوبت آنلاین، بدون تماس و انتظار" },
  { n: 3, shot: "my-salons", title: "سالن‌هات، یه‌جا", sub: "با یه ضربه دوباره نوبت بگیر" },
  { n: 4, shot: "my-bookings", title: "نوبتت جلوی چشمته", sub: "تأیید و یادآوری با اعلان گوشی" },
  { n: 5, shot: "where", title: "کجاست؟", sub: "نشونی دقیق روی نقشه، تا دم در" },
  { n: 6, shot: "salon-home", title: "برای سالن‌ها و آرتیست‌ها", sub: "نوبت‌ها، خدمات و مشتری‌ها یه‌جا" },
  { n: 7, both: "salon", title: "روز یا شب، مثل گوشیت", sub: "خودش با تنظیم گوشیت هماهنگ می‌شه" }
];

const css = `
@font-face { font-family: V; font-weight: 100 900; src: url("${asset("public/fonts/vazirmatn-arabic-wght-normal.woff2")}") format("woff2"); }
* { box-sizing: border-box; margin: 0; }
body { width: 1080px; height: 1920px; overflow: hidden; font-family: V, Tahoma, sans-serif; direction: rtl; position: relative;
  background: radial-gradient(900px 700px at 100% 0%, #ffe3ef 0%, transparent 70%), radial-gradient(800px 800px at 0% 45%, #efeaff 0%, transparent 70%), #fbfafe; color: #0c0d12; }
.brand { position: absolute; top: 92px; left: 0; right: 0; display: flex; justify-content: center; align-items: center; gap: 18px; font-size: 40px; font-weight: 800; }
.brand img { width: 76px; height: 76px; border-radius: 22px; }
h1 { position: absolute; top: 200px; left: 60px; right: 60px; text-align: center; font-size: 92px; font-weight: 900; line-height: 1.25;
  background: linear-gradient(120deg, #ff86b8 0%, #b58cff 52%, #7c5cff 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
p.sub { position: absolute; top: 335px; left: 60px; right: 60px; text-align: center; font-size: 40px; font-weight: 600; color: #4b4d5c; }
.phone { position: absolute; top: 470px; left: 50%; transform: translateX(-50%); width: 660px; height: 1374px; border-radius: 76px; background: #0c0d12; padding: 16px;
  box-shadow: 0 40px 90px rgb(91 63 214 / .22), 0 10px 30px rgb(12 13 18 / .18); }
.phone img { width: 628px; height: 1342px; border-radius: 60px; object-fit: cover; object-position: top; display: block; }
/* «روز یا شب»: two phones side by side, night on the left half */
body.both { background: linear-gradient(90deg, #0f1018 0 50%, #fbfafe 50% 100%); }
body.both .brand { width: max-content; margin: 0 auto; padding: 14px 30px; background: #fff; border-radius: 60px; left: 0; right: 0; }
body.both p.sub { background: #fff; border-radius: 50px; width: max-content; margin: 0 auto; padding: 10px 36px; color: #0c0d12; }
body.both .phone { width: 470px; height: 978px; border-radius: 58px; padding: 12px; transform: none; top: 520px; }
body.both .phone img { width: 446px; height: 954px; border-radius: 46px; }
body.both .phone.night { left: 35px; background: #2a2b38; } body.both .phone.day { left: auto; right: 35px; }
.label { position: absolute; top: 1560px; width: 540px; text-align: center; font-size: 58px; font-weight: 900; }
.label.night { left: 0; color: #fff; } .label.day { right: 0; color: #0c0d12; }
`;

function page(p, scheme) {
  const head = `<div class="brand"><img src="${asset("public/icons/icon-512.png")}"><span>فرفرو</span></div><h1>${p.title}</h1><p class="sub">${p.sub}</p>`;
  const body = p.both
    ? `<body class="both">${head}<div class="phone night"><img src="${raw(`${p.both}-dark`)}"></div><div class="phone day"><img src="${raw(`${p.both}-light`)}"></div><div class="label night">☾ تیره</div><div class="label day">☀ روشن</div></body>`
    : `<body>${head}<div class="phone"><img src="${raw(`${p.shot}-${scheme}`)}"></div></body>`;
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><style>${css}</style></head>${body}</html>`;
}

async function main() {
  fs.mkdirSync(FINAL, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 } });
  const tab = await ctx.newPage();
  for (const p of PAGES) {
    const html = path.join(FINAL, `_${p.n}.html`);
    fs.writeFileSync(html, page(p, "light"));
    await tab.goto(pathToFileURL(html).href);
    await tab.evaluate(() => globalThis.document.fonts.ready);
    await tab.waitForTimeout(400);
    await tab.screenshot({ path: path.join(FINAL, `${p.n}.png`) });
    fs.unlinkSync(html);
    console.log(`${p.n}.png`);
  }
  await browser.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
