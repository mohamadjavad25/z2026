#!/usr/bin/env node
// Everything the docs say about one area, in one place: the owner's decisions, the lessons from real bugs, the
// project notes and which longer docs to open. Claude runs it before touching an area, so a decision or lesson in
// the middle of a long file is never missed.
//
//   node scripts/docs/area.mjs                  list the areas
//   node scripts/docs/area.mjs bookings         everything about bookings
//   node scripts/docs/area.mjs "نوبت"           free words work too (matched as written)
import { readFileSync, existsSync } from "node:fs";

// Words that mark a line as being about the area (lowercase English, Persian as written). Add words when an area
// grows; an area that matches too much is better than one that misses a decision.
const AREAS = {
  bookings: { words: ["booking", "reserv", "نوبت", "رزرو", "capacity", "ظرفیت", "deadline", "مهلت", "slot", "visit", "«میای؟»", "waitlist", "خبرم کن", "attendance"], docs: ["docs/VISIT_BOOKER.md", "docs/FILTERING.md"] },
  billing: { words: ["billing", "subscription", "اشتراک", "plan", "پلن", "gateway", "درگاه", "zarinpal", "payment", "پرداخت", "free days", "رایگان", "sms pack", "بسته", "wallet", "کیف"], docs: [] },
  login: { words: ["login", "sign-up", "signup", "otp", "sms code", "ورود", "ثبت‌نام", "password", "رمز", "session", "phone number", "شماره", "admin login", "totp"], docs: [] },
  sms: { words: ["sms", "پیامک", "faraz", "فراز", "template", "الگو", "reminder", "یادآور"], docs: [] },
  push: { words: ["push", "اعلان", "fcm", "firebase", "notification", "notice"], docs: [] },
  team: { words: ["team", "تیم", "پرسنل", "collab", "همکاری", "join", "invite", "دعوت", "artist on", "salon's link", "break", "استراحت", "مرخصی", "leave"], docs: [] },
  connecting: { words: ["connect", "وصل", "follow", "دنبال", "qr", "invite"], docs: [] },
  directory: { words: ["directory", "search", "جست", "filter", "فیلتر", "map", "نقشه", "location", "کجاست", "public page", "صفحهٔ عمومی"], docs: ["docs/FILTERING.md"] },
  customers: { words: ["customer", "client list", "مشتری", "contact", "مخاطب", "same person", "همان آدم", "history", "سابقه"], docs: [] },
  stories: { words: ["story", "استوری", "instagram", "اینستاگرام", "home card", "کارت"], docs: ["docs/STORY_WORK.md"] },
  design: { words: ["colour", "color", "رنگ", "token", "violet", "بنفش", "pink", "صورتی", "black", "مشکی", "icon", "آیکون", "logo", "لوگو", "style", "css", "sheet", "برگه"], docs: ["docs/DESIGN_SYSTEM.md", "docs/UI_AUDIT.md"] },
  copy: { words: ["copy", "text", "متن", "wording", "«تو»", "persian", "فارسی", "name", "اسم"], docs: ["docs/COPY.md"] },
  website: { words: ["landing", "website", "سایت", "about page", "download", "دانلود", "tutorial", "آموزش", "onboarding", "slide", "اسلاید"], docs: [] },
  app: { words: ["android", "اندروید", "ios", "آیفون", "iphone", "capacitor", "apk", "bazaar", "بازار", "myket", "versioncode", "release", "shell", "update", "به‌روزرسانی"], docs: ["docs/STORE_LISTING.md", "docs/LAUNCH_CHECKLIST.md"] },
  server: { words: ["server", "سرور", "deploy", "استقرار", "vercel", "ورسل", "backup", "بکاپ", "migration", "storage", "s3", "arvan", "آروان", "move", "جابه‌جایی", "cron", "health", "load test"], docs: ["docs/DEPLOY_SERVER.md", "docs/OPERATIONS.md", "docs/SERVER_MOVE.md"] },
  admin: { words: ["admin", "مدیر", "support", "پشتیبانی", "news", "خبر"], docs: [] },
};

const pick = process.argv.slice(2).join(" ").trim();
if (!pick) {
  console.log("Areas:", Object.keys(AREAS).join(", "));
  console.log('Usage: node scripts/docs/area.mjs <area | "free words">');
  process.exit(0);
}
const area = AREAS[pick.toLowerCase()];
const words = area ? area.words : pick.split(/\s+/);
const matches = (line) => { const l = line.toLowerCase(); return words.some((w) => l.includes(w.toLowerCase())); };

const read = (path) => (existsSync(path) ? readFileSync(path, "utf8") : "");
const bullets = (text) => text.split("\n").filter((l) => /^\s*[-*] /.test(l) || /^\d+\. /.test(l));
const lessonsPart = (() => { const h = read("docs/HEALTH.md"); const at = h.indexOf("## درس‌ها"); return at === -1 ? "" : h.slice(at); })();

const sections = [
  ["Owner's decisions (docs/DECISIONS.md), never ask these again", bullets(read("docs/DECISIONS.md"))],
  ["Lessons from real bugs (docs/HEALTH.md «درس‌ها»), do not repeat them", bullets(lessonsPart)],
  ["Project notes (docs/PROJECT_NOTES.md)", bullets(read("docs/PROJECT_NOTES.md"))],
];
let total = 0;
for (const [title, lines] of sections) {
  const found = lines.filter(matches);
  total += found.length;
  console.log(`\n## ${title}: ${found.length}`);
  for (const l of found) console.log(l.trim());
}
if (area?.docs.length) console.log(`\n## Also open: ${area.docs.join(", ")}`);
console.log(`\n(${total} line(s) for "${pick}". The roadmap, docs/ROADMAP.md, holds ideas only: never start one without the owner.)`);
