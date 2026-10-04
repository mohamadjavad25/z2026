// Builds docs/mascot/STICKERS.md — the full, copy-ready sticker brief (one prompt per sticker).
// Data lives in scripts/mascot-data.mjs. Run: node scripts/mascot-prompts.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { SERVICE_SCENES, APP_SCENES } from "./mascot-data.mjs";

const CHARACTER =
  "Same mascot as the reference image, identical design, colors and line style: chubby cream-white creature, orange curly hair with a heart-shaped curl on top, big glossy dark eyes, rose-pink cheeks, pink apron, makeup brush behind the ear.";
const STYLE =
  "Flat vector sticker style, clean dark outline of uniform weight, soft cel-shading. Single sticker centered, pure white background (#FFFFFF), generous empty margin around it, no text, no letters, no border, no frame, no ground shadow. No purple or violet. Very high resolution, square canvas, at least 2048px.";

const groups = (obj) => Object.entries(obj);
const total = (obj) => groups(obj).reduce((n, [, g]) => n + g.items.length, 0);
const nS = total(SERVICE_SCENES);
const nA = total(APP_SCENES);

let out = `# بریف کامل استیکرهای زیبابان (${nS + nA} استیکر)

${nS} استیکر خدمت (جایگزین آیکون‌های فعلی؛ \`id\` ها در دیتابیس ذخیره شده‌اند و نباید عوض شوند) + ${nA} استیکر موقعیت‌های برنامه (حالت خالی، وضعیت رزرو، خطا، لودینگ، نقش‌ها، واکنش‌ها، برند).

## روش کار
1. تصویر مرجع کاراکتر را (همان که تأیید کردی) همراه **هر** پرامپت به ابزار تصویرساز بده.
2. هر استیکر = یک پرامپت = یک تصویر مربع با پس‌زمینه سفید خالص. پرامپت = «قفل کاراکتر» + «صحنه» + «قفل سبک» (پایین هر مورد کامل نوشته شده، کپی‌آماده).
3. فایل را با نام \`id\` ذخیره کن: \`id.png\` (مثلاً \`haircut.png\`). بعداً پس‌زمینه سفید شفاف و به \`public/emoji/id.webp\` (512) و \`id@128.webp\` تبدیل می‌شود (\`scripts/slice-sticker-sheet.mjs\`).
4. اگر ابزار شیت چندتایی می‌دهد، ۶ تا در هر شیت با فاصله زیاد بخواه و در پرامپت «A row of 6 separate stickers» بگذار؛ ولی تک‌تک کیفیت و ثبات کاراکتر بهتر است.

## قفل کاراکتر (اول هر پرامپت)
> ${CHARACTER}

## قفل سبک (آخر هر پرامپت)
> ${STYLE}

## قواعد ثابت
- هیچ متن/حرف/عدد داخل تصویر نباشد (متن را خود برنامه می‌نویسد).
- بنفش و ارغوانی ممنوع؛ رنگ‌ها گرم و شاد (نارنجی، مرجانی، صورتی، فیروزه‌ای، کرم، زرد).
- ضخامت خط و سایه‌زنی در همه یکسان؛ چشم‌ها و گونه‌ها دقیقاً مثل مرجع.
- هر استیکر باید در اندازه ۴۸ پیکسل هم خوانا باشد: یک ایده، یک پراپ اصلی، سیلوئت واضح.
- کاراکتر وسط کادر و ۱۰٪ حاشیه خالی؛ بدون سایه زمین.

`;

function section(partTitle, obj) {
  let s = `\n---\n\n# ${partTitle}\n`;
  let n = 0;
  for (const [key, g] of groups(obj)) {
    s += `\n## ${g.title} (${g.items.length}) — \`${key}\`\n`;
    if (g.palette) s += `رنگ‌های این گروه: ${g.palette}\n`;
    for (const [id, fa, scene] of g.items) {
      n += 1;
      s += `\n### ${n}. ${fa} — \`${id}.png\`\n- [ ] ساخته شد\n\n\`\`\`text\n${CHARACTER} ${scene} ${STYLE}\n\`\`\`\n`;
    }
  }
  return s;
}

out += section(`بخش الف — استیکر خدمات (${nS})`, SERVICE_SCENES);
out += section(`بخش ب — استیکر موقعیت‌های برنامه (${nA})`, APP_SCENES);

mkdirSync("docs/mascot", { recursive: true });
writeFileSync("docs/mascot/STICKERS.md", out);
console.log(`wrote docs/mascot/STICKERS.md — ${nS} service + ${nA} app = ${nS + nA}`);
