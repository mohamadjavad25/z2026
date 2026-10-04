#!/usr/bin/env node
/**
 * Mascot sticker prompt generator.
 *
 * Reads scripts/mascot-data.mjs and writes:
 *   docs/mascot/STICKERS.md        human checklist + copy-ready prompts
 *   docs/mascot/prompts/<id>.txt   one prompt per file (for batch tools)
 *   docs/mascot/prompts.jsonl      one JSON object per line (for API batch jobs)
 *   docs/mascot/prompts.csv        spreadsheet-friendly
 *
 * Status is NOT stored in the markdown. It is derived from disk on every run:
 *   assets/mascot/raw/<id>.png         -> "made"      (generated image exists)
 *   assets/mascot/stickers/<id>.webp   -> "processed" (cut out + exported)
 * so regenerating never wipes progress.
 *
 * Usage:
 *   node scripts/mascot-prompts.mjs                 validate + write all outputs
 *   node scripts/mascot-prompts.mjs --check         validate + fail if outputs are stale (CI)
 *   node scripts/mascot-prompts.mjs --print --only haircut,booking_confirmed
 *   node scripts/mascot-prompts.mjs --print --pending   print every prompt not made yet
 *
 * Options:
 *   --data <path>      data module          (default scripts/mascot-data.mjs)
 *   --docs <dir>       docs output dir      (default docs/mascot)
 *   --raw <dir>        generated images dir (default assets/mascot/raw)
 *   --stickers <dir>   processed images dir (default assets/mascot/stickers)
 */
import { readFile, writeFile, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ------------------------------------------------------------------ */
/* Defaults (used only if mascot-data.mjs does not export its own)     */
/* ------------------------------------------------------------------ */

const DEFAULT_CHARACTER_LOCK = `The exact same mascot as the attached reference image, keeping its design, proportions, colors and line style identical: a small, chubby, soft-rounded creature (not a human) with a round cream-white body, big glossy dark-brown eyes with tiny white highlights, small rose-pink blush cheeks, a tiny smiling mouth, short stubby arms and legs, a big fluffy cloud of bright orange curly hair with one heart-shaped curl on top, a soft-pink apron with a small mint comb and golden scissors pin, and a pink makeup brush with a black handle tucked behind one ear.`;

const DEFAULT_STYLE_LOCK = `Flat modern vector sticker illustration, clean thin dark-ink outline (#14161d) of uniform weight, soft cel-shading with one gentle shadow tone, limited pastel palette (cream white, rose pink, peach, mint, soft sky blue, butter yellow, bright orange hair) with ink-black details. Cheerful, warm, playful, premium, slightly kawaii.`;

const COMPOSITION = `Square 1:1 image, the character centered and filling about 80% of the frame with even empty margin on all sides. One clear pose and at most one or two props, with a bold simple silhouette that stays readable at 48×48 pixels.`;

const NEGATIVE = `Pure plain white background. No text, letters, numbers or logos anywhere. No purple, violet, lavender or lilac anywhere. No frame, border, badge, circle or colored backdrop behind the character, and no shadow on the ground.`;

/* ------------------------------------------------------------------ */
/* Validation rules                                                    */
/* ------------------------------------------------------------------ */

const ID_RE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const BANNED_COLOR_RE = /\b(purple|violet|lavender|lilac|mauve|plum|magenta|indigo|amethyst|orchid|grape)\b/i;
const TEXTY_RE = /\b(text|word|words|letters?|caption|label|typography|written|writing|numbers?|digits?|logo|says|reads)\b/i;
const NON_LATIN_RE = /[\u0600-\u06FF]/; // Persian/Arabic script inside an English prompt
const SCENE_MIN = 40;
const SCENE_MAX = 700;

/* ------------------------------------------------------------------ */

const args = parseArgs(process.argv.slice(2));
const paths = {
  data: path.resolve(ROOT, args.data ?? 'scripts/mascot-data.mjs'),
  docs: path.resolve(ROOT, args.docs ?? 'docs/mascot'),
  raw: path.resolve(ROOT, args.raw ?? 'assets/mascot/raw'),
  stickers: path.resolve(ROOT, args.stickers ?? 'assets/mascot/stickers'),
};

const data = normalize(await import(pathToFileURL(paths.data).href));
const { errors, warnings } = validate(data);

for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`error ${e}`);
if (errors.length) {
  console.error(`\n${errors.length} error(s). Nothing written.`);
  process.exit(1);
}

const items = data.sections.flatMap((s) => s.groups.flatMap((g) => g.items));
const rawFiles = await listFiles(paths.raw);
const stickerFiles = await listFiles(paths.stickers);
for (const it of items) {
  it.prompt = buildPrompt(it, data);
  it.made = rawFiles.has(it.file);
  it.processed = stickerFiles.has(`${it.id}.webp`);
}

if (args.print) {
  printPrompts(items, args);
  process.exit(0);
}

const outputs = new Map();
outputs.set(path.join(paths.docs, 'STICKERS.md'), renderMarkdown(data, items));
outputs.set(path.join(paths.docs, 'prompts.jsonl'), renderJsonl(data, items));
outputs.set(path.join(paths.docs, 'prompts.csv'), renderCsv(data, items));
for (const it of items) outputs.set(path.join(paths.docs, 'prompts', `${it.id}.txt`), it.prompt + '\n');

if (args.check) {
  const stale = [];
  for (const [file, content] of outputs) {
    if ((await readText(file)) !== content) stale.push(path.relative(ROOT, file));
  }
  const orphans = await orphanPromptFiles(items);
  stale.push(...orphans.map((f) => `${path.relative(ROOT, f)} (orphan)`));
  if (stale.length) {
    console.error(`Outputs are stale. Run: node scripts/mascot-prompts.mjs\n  ${stale.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`OK: ${items.length} stickers, outputs up to date.`);
  process.exit(0);
}

let written = 0;
for (const [file, content] of outputs) {
  if ((await readText(file)) === content) continue;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
  written++;
}
for (const f of await orphanPromptFiles(items)) {
  await rm(f);
  written++;
}

const made = items.filter((i) => i.made).length;
const processed = items.filter((i) => i.processed).length;
console.log(
  `${items.length} stickers · ${made} made · ${processed} processed · ${written} file(s) changed` +
    (warnings.length ? ` · ${warnings.length} warning(s)` : ''),
);

/* ================================================================== */
/* Data loading                                                        */
/* ================================================================== */

/**
 * Accepts either shape from mascot-data.mjs:
 *
 *  A) nested:  export const SECTIONS = [{ key, title, groups: [{ key, title, items: [{ id, fa, scene }] }] }]
 *  B) flat:    export const STICKERS = [{ id, fa, scene, section, group }]
 *              (+ optional SECTION_TITLES / GROUP_TITLES maps)
 *
 * Item field aliases: fa | name_fa | nameFa | title ; scene | description | prompt.
 * Optional exports: CHARACTER_LOCK, STYLE_LOCK, EXPECTED_COUNTS ({ [sectionKey]: n }).
 */
function normalize(mod) {
  const m = mod.default && typeof mod.default === 'object' ? { ...mod, ...mod.default } : mod;
  const pick = (...keys) => keys.map((k) => m[k]).find((v) => v !== undefined);

  const characterLock = pick('CHARACTER_LOCK', 'characterLock') ?? DEFAULT_CHARACTER_LOCK;
  const styleLock = pick('STYLE_LOCK', 'styleLock') ?? DEFAULT_STYLE_LOCK;
  const expected = pick('EXPECTED_COUNTS', 'expectedCounts') ?? null;

  let sections = pick('SECTIONS', 'sections');
  if (!sections) {
    const flat = pick('STICKERS', 'stickers');
    if (!Array.isArray(flat)) {
      throw new Error('mascot-data.mjs must export SECTIONS (nested) or STICKERS (flat array).');
    }
    const sTitles = pick('SECTION_TITLES', 'sectionTitles') ?? {};
    const gTitles = pick('GROUP_TITLES', 'groupTitles') ?? {};
    const byS = new Map();
    for (const it of flat) {
      const sk = it.section ?? 'default';
      const gk = it.group ?? 'default';
      if (!byS.has(sk)) byS.set(sk, new Map());
      const byG = byS.get(sk);
      if (!byG.has(gk)) byG.set(gk, []);
      byG.get(gk).push(it);
    }
    sections = [...byS].map(([sk, byG]) => ({
      key: sk,
      title: sTitles[sk] ?? sk,
      groups: [...byG].map(([gk, its]) => ({ key: gk, title: gTitles[gk] ?? gk, items: its })),
    }));
  }

  let n = 0;
  return {
    characterLock: clean(characterLock),
    styleLock: clean(styleLock),
    expected,
    sections: sections.map((s) => ({
      key: String(s.key ?? s.id ?? s.title),
      title: s.title ?? s.fa ?? s.key,
      groups: (s.groups ?? []).map((g) => ({
        key: String(g.key ?? g.id ?? g.title),
        title: g.title ?? g.fa ?? g.key,
        items: (g.items ?? g.stickers ?? []).map((it) => {
          const id = String(it.id ?? '').trim();
          return {
            n: ++n,
            id,
            fa: it.fa ?? it.name_fa ?? it.nameFa ?? it.title ?? id,
            scene: clean(it.scene ?? it.description ?? it.prompt ?? ''),
            file: it.file ?? `${id}.png`,
            section: String(s.key ?? s.title),
            group: String(g.key ?? g.title),
          };
        }),
      })),
    })),
  };
}

/* ================================================================== */
/* Validation                                                          */
/* ================================================================== */

function validate(d) {
  const errors = [];
  const warnings = [];
  const seenIds = new Map();
  const seenScenes = new Map();

  for (const s of d.sections) {
    let count = 0;
    for (const g of s.groups) {
      if (!g.items.length) warnings.push(`group "${g.title}" in section "${s.title}" is empty`);
      for (const it of g.items) {
        count++;
        const where = `${it.id || '(no id)'} [${s.key}/${g.key}]`;

        if (!it.id) errors.push(`${where}: missing id`);
        else if (!ID_RE.test(it.id)) errors.push(`${where}: id must be lowercase snake_case`);
        if (seenIds.has(it.id)) errors.push(`${where}: duplicate id (also in ${seenIds.get(it.id)})`);
        seenIds.set(it.id, `${s.key}/${g.key}`);

        if (it.file !== `${it.id}.png`) errors.push(`${where}: file "${it.file}" must be "${it.id}.png"`);

        if (!it.scene) errors.push(`${where}: missing scene`);
        else {
          if (NON_LATIN_RE.test(it.scene)) errors.push(`${where}: scene contains Persian text; prompts must be English`);
          if (BANNED_COLOR_RE.test(it.scene)) errors.push(`${where}: scene mentions a banned color (${it.scene.match(BANNED_COLOR_RE)[0]})`);
          if (TEXTY_RE.test(it.scene)) warnings.push(`${where}: scene mentions "${it.scene.match(TEXTY_RE)[0]}"; generators tend to draw text when they read this`);
          if (it.scene.length < SCENE_MIN) warnings.push(`${where}: scene is very short (${it.scene.length} chars)`);
          if (it.scene.length > SCENE_MAX) warnings.push(`${where}: scene is long (${it.scene.length} chars); long scenes dilute the character lock`);
          const key = it.scene.toLowerCase();
          if (seenScenes.has(key)) warnings.push(`${where}: same scene as ${seenScenes.get(key)}`);
          seenScenes.set(key, it.id);
        }

        if (!it.fa || it.fa === it.id) warnings.push(`${where}: missing Persian name`);
      }
    }
    if (d.expected && d.expected[s.key] !== undefined && d.expected[s.key] !== count) {
      errors.push(`section "${s.title}": expected ${d.expected[s.key]} stickers, found ${count}`);
    }
  }

  if (BANNED_COLOR_RE.test(d.characterLock)) errors.push('CHARACTER_LOCK mentions a banned color');
  return { errors, warnings };
}

/* ================================================================== */
/* Prompt assembly                                                     */
/* ================================================================== */

function buildPrompt(it, d) {
  return [d.characterLock, `Scene: ${it.scene}`, COMPOSITION, d.styleLock, NEGATIVE].join('\n\n');
}

/* ================================================================== */
/* Renderers (deterministic: no timestamps, so diffs stay clean)       */
/* ================================================================== */

function renderMarkdown(d, items) {
  const pad = String(items.length).length;
  const num = (n) => String(n).padStart(Math.max(3, pad), '0');
  const made = items.filter((i) => i.made).length;
  const processed = items.filter((i) => i.processed).length;
  const L = [];

  L.push('# لیست استیکرهای ماسکات', '');
  L.push('> این فایل خودکار ساخته می‌شود. دستی ویرایش نکنید؛ داده‌ها را در `scripts/mascot-data.mjs` تغییر دهید و `node scripts/mascot-prompts.mjs` را اجرا کنید.', '');
  L.push('## روش کار', '');
  L.push('1. تصویر مرجع (برگه‌ی شخصیت) را همراه **هر** پرامپت به ابزار تولید تصویر بدهید.');
  L.push('2. هر پرامپت فقط **یک** تصویر مربع با پس‌زمینه‌ی سفید خالص می‌سازد.');
  L.push('3. خروجی را با نام دقیق فایل در `assets/mascot/raw/` بگذارید (مثلاً `haircut.png`).');
  L.push('4. اسکریپت را دوباره اجرا کنید؛ وضعیت‌ها خودکار به‌روز می‌شوند.');
  L.push('');
  L.push('قواعد ثابت: بدون متن داخل تصویر، بدون بنفش، بدون قاب یا پس‌زمینه‌ی رنگی، خوانا در ۴۸ پیکسل.', '');
  L.push('وضعیت‌ها: ⬜ ساخته نشده · 🟡 ساخته شد (`raw/<id>.png`) · ✅ پردازش شد (`stickers/<id>.webp`)', '');

  L.push('## پیشرفت', '');
  L.push(`**کل: ${made} از ${items.length} ساخته شد · ${processed} پردازش شد**`, '');
  L.push('| بخش | گروه | تعداد | ساخته شد | پردازش شد |');
  L.push('|---|---|---:|---:|---:|');
  for (const s of d.sections) {
    for (const g of s.groups) {
      const gi = g.items;
      L.push(`| ${s.title} | [${g.title}](#${anchor(s, g)}) | ${gi.length} | ${gi.filter((i) => i.made).length} | ${gi.filter((i) => i.processed).length} |`);
    }
  }
  L.push('');

  for (const s of d.sections) {
    L.push(`## ${s.title}`, '');
    for (const g of s.groups) {
      L.push(`<a id="${anchor(s, g)}"></a>`, '');
      L.push(`### ${g.title} (${g.items.length})`, '');
      for (const it of g.items) {
        const icon = it.processed ? '✅' : it.made ? '🟡' : '⬜';
        L.push(`#### ${icon} ${num(it.n)} · ${it.fa} · \`${it.file}\``, '');
        L.push('```text', it.prompt, '```', '');
      }
    }
  }
  return L.join('\n');
}

function renderJsonl(d, items) {
  return items
    .map((it) => JSON.stringify({ n: it.n, id: it.id, file: it.file, section: it.section, group: it.group, fa: it.fa, prompt: it.prompt }))
    .join('\n') + '\n';
}

function renderCsv(d, items) {
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [['n', 'id', 'file', 'section', 'group', 'fa', 'prompt'].join(',')];
  for (const it of items) rows.push([it.n, it.id, it.file, it.section, it.group, it.fa, it.prompt].map(esc).join(','));
  return '\uFEFF' + rows.join('\r\n') + '\r\n'; // BOM so Excel shows Persian correctly
}

function printPrompts(items, a) {
  let sel = items;
  if (a.only) {
    const ids = a.only.split(',').map((s) => s.trim()).filter(Boolean);
    const unknown = ids.filter((id) => !items.some((i) => i.id === id));
    if (unknown.length) {
      console.error(`Unknown id(s): ${unknown.join(', ')}`);
      process.exit(1);
    }
    sel = ids.map((id) => items.find((i) => i.id === id));
  }
  if (a.pending) sel = sel.filter((i) => !i.made);
  if (!sel.length) {
    console.error('Nothing to print.');
    return;
  }
  for (const it of sel) {
    console.log(`===== ${it.file} · ${it.fa} =====\n\n${it.prompt}\n`);
  }
  console.error(`${sel.length} prompt(s).`);
}

/* ================================================================== */
/* Helpers                                                             */
/* ================================================================== */

function anchor(s, g) {
  return `g-${s.key}-${g.key}`.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
}

function clean(s) {
  return String(s).replace(/\s+/g, ' ').trim();
}

async function readText(file) {
  try {
    return await readFile(file, 'utf8');
  } catch {
    return null;
  }
}

async function listFiles(dir) {
  try {
    const entries = await readdir(dir);
    const out = new Set();
    for (const e of entries) {
      if ((await stat(path.join(dir, e))).isFile()) out.add(e);
    }
    return out;
  } catch {
    return new Set();
  }
}

async function orphanPromptFiles(items) {
  const dir = path.join(paths.docs, 'prompts');
  const keep = new Set(items.map((i) => `${i.id}.txt`));
  return [...(await listFiles(dir))].filter((f) => f.endsWith('.txt') && !keep.has(f)).map((f) => path.join(dir, f));
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const [k, inline] = a.slice(2).split('=');
    const next = argv[i + 1];
    if (inline !== undefined) out[k] = inline;
    else if (['data', 'docs', 'raw', 'stickers', 'only'].includes(k) && next && !next.startsWith('--')) {
      out[k] = next;
      i++;
    } else out[k] = true;
  }
  return out;
}
