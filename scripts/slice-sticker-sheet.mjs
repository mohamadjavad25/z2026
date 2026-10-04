// Slice a generated sticker sheet (stickers on a pure white background) into one transparent
// WebP/PNG per icon id.
//
//   node scripts/slice-sticker-sheet.mjs mascot/sheets/sheet-01.png --ids haircut,hair_color,... [--out public/emoji] [--size 512]
//
// Order of --ids must match the sheet: left to right, top to bottom. Stickers must not touch.
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith("--"));
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const ids = String(opt("ids", "")).split(",").filter(Boolean);
const outDir = opt("out", "public/emoji");
const size = Number(opt("size", "512"));
if (!input || !ids.length) {
  console.error("usage: slice-sticker-sheet.mjs <sheet.png> --ids a,b,c [--out dir] [--size 512]");
  process.exit(1);
}

const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;
const isBg = (i) => data[i * 4] >= 244 && data[i * 4 + 1] >= 244 && data[i * 4 + 2] >= 244;

// 1. Flood-fill the white background from the border (white INSIDE an outlined sticker stays).
const bg = new Uint8Array(W * H);
const stack = [];
const push = (x, y) => {
  const i = y * W + x;
  if (!bg[i] && isBg(i)) {
    bg[i] = 1;
    stack.push(i);
  }
};
for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
while (stack.length) {
  const i = stack.pop();
  const x = i % W;
  const y = (i / W) | 0;
  if (x > 0) push(x - 1, y);
  if (x < W - 1) push(x + 1, y);
  if (y > 0) push(x, y - 1);
  if (y < H - 1) push(x, y + 1);
}

// 2. Alpha: background -> 0; light anti-aliasing fringe next to the background fades out.
for (let i = 0; i < W * H; i++) {
  if (bg[i]) { data[i * 4 + 3] = 0; continue; }
  const x = i % W;
  const y = (i / W) | 0;
  const nearBg = (x > 0 && bg[i - 1]) || (x < W - 1 && bg[i + 1]) || (y > 0 && bg[i - W]) || (y < H - 1 && bg[i + W]);
  if (nearBg) {
    const light = Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    if (light > 225) data[i * 4 + 3] = Math.round(255 * Math.max(0, (255 - light) / 30));
  }
}

// 3. Group pixels into stickers on a coarse grid, merging parts closer than ~GAP px
//    (sparkles and props that float near their sticker).
const CELL = 8;
const GAP = Math.max(2, Math.round(W / 3000 * 4));
const gw = Math.ceil(W / CELL);
const gh = Math.ceil(H / CELL);
const grid = new Uint8Array(gw * gh);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * 4 + 3] > 40) grid[((y / CELL) | 0) * gw + ((x / CELL) | 0)] = 1;
  }
}
const label = new Int32Array(gw * gh).fill(-1);
const clusters = [];
for (let s = 0; s < grid.length; s++) {
  if (!grid[s] || label[s] >= 0) continue;
  const id = clusters.length;
  const box = { x0: gw, y0: gh, x1: 0, y1: 0, n: 0 };
  const q = [s];
  label[s] = id;
  while (q.length) {
    const c = q.pop();
    const cx = c % gw;
    const cy = (c / gw) | 0;
    box.x0 = Math.min(box.x0, cx); box.x1 = Math.max(box.x1, cx);
    box.y0 = Math.min(box.y0, cy); box.y1 = Math.max(box.y1, cy);
    box.n++;
    for (let dy = -GAP; dy <= GAP; dy++) {
      for (let dx = -GAP; dx <= GAP; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const ni = ny * gw + nx;
        if (grid[ni] && label[ni] < 0) { label[ni] = id; q.push(ni); }
      }
    }
  }
  clusters.push(box);
}
const big = clusters.sort((a, b) => b.n - a.n).slice(0, ids.length);
if (big.length < ids.length || (clusters[ids.length] && clusters[ids.length].n > big[big.length - 1].n * 0.25)) {
  console.error(`expected ${ids.length} separate stickers, found ${clusters.filter((c) => c.n > big[0].n * 0.1).length}. Regenerate the sheet with more space between stickers.`);
  process.exit(2);
}

// 4. Reading order: rows by vertical centre, then left to right.
const withC = big.map((b) => ({ ...b, cy: (b.y0 + b.y1) / 2, cx: (b.x0 + b.x1) / 2, h: b.y1 - b.y0 }));
withC.sort((a, b) => a.cy - b.cy);
const rows = [];
for (const b of withC) {
  const row = rows.find((r) => Math.abs(r.cy - b.cy) < b.h * 0.6);
  if (row) { row.items.push(b); row.cy = (row.cy * (row.items.length - 1) + b.cy) / row.items.length; }
  else rows.push({ cy: b.cy, items: [b] });
}
const ordered = rows.sort((a, b) => a.cy - b.cy).flatMap((r) => r.items.sort((a, b) => a.cx - b.cx));

// 5. Crop, trim, pad, resize, write.
mkdirSync(outDir, { recursive: true });
const full = sharp(data, { raw: { width: W, height: H, channels: 4 } });
for (let k = 0; k < ids.length; k++) {
  const b = ordered[k];
  const pad = CELL * 2;
  const left = Math.max(0, b.x0 * CELL - pad);
  const top = Math.max(0, b.y0 * CELL - pad);
  const width = Math.min(W - left, (b.x1 + 1) * CELL - left + pad);
  const height = Math.min(H - top, (b.y1 + 1) * CELL - top + pad);
  if (process.env.DEBUG_SLICE) console.log(ids[k], { left, top, width, height, W, H });
  const region = await full.clone().extract({ left, top, width, height }).png().toBuffer();
  // trim in a second pipeline: sharp applies trim before extract when they are chained.
  const cropped = await sharp(region).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 }).png().toBuffer();
  const inner = Math.round(size * 0.92);
  const base = sharp(cropped).resize(inner, inner, { fit: "inside" });
  const resized = await base.png().toBuffer();
  const canvas = sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: resized, gravity: "center" }]);
  const png = await canvas.clone().png({ compressionLevel: 9 }).toBuffer();
  await sharp(png).webp({ quality: 92, alphaQuality: 100 }).toFile(join(outDir, `${ids[k]}.webp`));
  await sharp(png).resize(128, 128).webp({ quality: 90, alphaQuality: 100 }).toFile(join(outDir, `${ids[k]}@128.webp`));
  console.log(`${ids[k]}: ${width}x${height} -> ${outDir}/${ids[k]}.webp`);
}
