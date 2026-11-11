/**
 * The ready story picture itself: the looks, their colours and every stroke on the 1080 x 1920 canvas.
 * Moved out of InstagramStorySheet as it was; the sheet only asks drawStory for a picture.
 */
import { formatPersianDayTitle } from "../../shared/lib/persianCalendar";
import { toPersianDigits } from "../../shared/lib/digits";
import { STORY_MAX_DAYS, STORY_TIMES_PER_DAY } from "./storySuggestion";

const W = 1080;
const H = 1920;
const INK = "#0c0d12";
const PINK = "#ff86b8";
const VIOLET_DEEP = "#5b3fd6";
const FONT = "Vazirmatn, Tahoma, sans-serif";
export const WORKS_NEEDED = 3;

// Instagram covers about the top 12% and bottom 14% of a story with its own bars: nothing important goes there.
const SAFE_TOP = 230;
// The link box sits just above Instagram's bottom bar; everything else stays above it.
const LINK_BOX_Y = 1440;
const LINK_BOX_H = 200;

export const TEXTS = [
  ["رزرو کن", "تا پر نشده"],
  ["امشب هنوز", "جا دارم"],
  ["یه وقت خالی", "برای تو"],
  ["نوبتت رو", "همین الان بگیر"]
];

/**
 * The looks, one slide each (owner's redesign 2026-11-01, https://claude.ai/artifact/FSrucn3rYLGE5DgnfJee3J): four
 * free-times looks and the works collage. Swiping changes the look; the colours of every part come from here.
 */
export const LOOKS = [
  { id: "night", label: "شب", kind: "free", dark: true },
  { id: "rose", label: "صورتی", kind: "free", dark: false },
  { id: "photo", label: "نمونه‌کار و ساعت", kind: "free", dark: true, needsWork: true },
  { id: "light", label: "ساده", kind: "free", dark: false },
  { id: "works", label: "نمونه‌کارها", kind: "works", dark: true }
];

function palette(dark) {
  return dark
    ? { text: "#ffffff", soft: "rgba(255,255,255,0.74)", kick: PINK, chip: "#ffffff", chipText: INK, chip2: "rgba(255,255,255,0.1)", chip2Line: "rgba(255,255,255,0.42)", chip2Text: "#ffffff", box: "rgba(255,255,255,0.08)", boxLine: "rgba(255,255,255,0.18)", slot: "rgba(255,134,184,0.9)", hint: "rgba(255,255,255,0.5)", arrow: PINK, ring: "#ffffff" }
    : { text: INK, soft: "rgba(12,13,18,0.66)", kick: VIOLET_DEEP, chip: INK, chipText: "#ffffff", chip2: "rgba(255,255,255,0.55)", chip2Line: "rgba(12,13,18,0.35)", chip2Text: INK, box: "rgba(255,255,255,0.5)", boxLine: "rgba(12,13,18,0.14)", slot: "rgba(91,63,214,0.85)", hint: "rgba(12,13,18,0.5)", arrow: VIOLET_DEEP, ring: "#ffffff" };
}

/** A typed headline as one or two balanced lines. */
export function headlineLines(typed) {
  const words = String(typed || "").trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return [words[0] || ""];
  let best = 1;
  let gap = Infinity;
  for (let i = 1; i < words.length; i += 1) {
    const diff = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
    if (diff < gap) { gap = diff; best = i; }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Shrinks the font until `text` fits `maxWidth`. */
function fitFont(ctx, text, weight, size, maxWidth) {
  let px = size;
  do {
    ctx.font = `${weight} ${px}px ${FONT}`;
    px -= 4;
  } while (px > 40 && ctx.measureText(text).width > maxWidth);
}

/** Resolves to the picture, or null when it cannot load (a missing work just leaves its tile dark). */
function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Fills the box with the picture, cropped from the middle, like object-fit: cover. */
function drawCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

function glow(ctx, x, y, r, color, edge = "rgba(12,13,18,0)") {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, edge);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** The brand's pink-to-violet blend across a line of text that ends at `right` (RTL). */
function blendFill(ctx, right, width) {
  const g = ctx.createLinearGradient(right, 0, right - width, 0);
  g.addColorStop(0, PINK);
  g.addColorStop(0.55, "#b58cff");
  g.addColorStop(1, "#7c5cff");
  return g;
}

/** Each look's ground. `photo`: a work across the top fading into ink (the «نمونه‌کار و ساعت» look). */
function drawGround(ctx, look, photo) {
  if (look === "rose") {
    const g = ctx.createLinearGradient(W, 0, 0, H);
    g.addColorStop(0, "#ffc2db");
    g.addColorStop(0.5, "#ff9cc6");
    g.addColorStop(1, "#c9a6ff");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    glow(ctx, 200, 260, 700, "rgba(255,255,255,0.45)", "rgba(255,255,255,0)");
    return;
  }
  if (look === "light") {
    ctx.fillStyle = "#f7f5ff";
    ctx.fillRect(0, 0, W, H);
    glow(ctx, 960, 200, 760, "rgba(255,134,184,0.22)", "rgba(247,245,255,0)");
    glow(ctx, 80, 1700, 820, "rgba(139,108,255,0.2)", "rgba(247,245,255,0)");
    return;
  }
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  if (photo) {
    const ph = 900;
    drawCover(ctx, photo, 0, 0, W, ph);
    const fade = ctx.createLinearGradient(0, ph * 0.35, 0, ph);
    fade.addColorStop(0, "rgba(12,13,18,0)");
    fade.addColorStop(0.65, "rgba(12,13,18,0.85)");
    fade.addColorStop(1, INK);
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, W, ph);
    const top = ctx.createLinearGradient(0, 0, 0, 420);
    top.addColorStop(0, "rgba(12,13,18,0.55)");
    top.addColorStop(1, "rgba(12,13,18,0)");
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, 420);
    return;
  }
  glow(ctx, 900, 260, 860, "rgba(255,134,184,0.34)");
  glow(ctx, 120, 1560, 900, "rgba(139,108,255,0.4)");
}

/** True when the name starts in Latin letters ("sara"), so its row reads from the left. */
function isLatinName(name) {
  const first = String(name || "").match(/[A-Za-z؀-ۿ]/);
  return Boolean(first && /[A-Za-z]/.test(first[0]));
}

/**
 * Avatar (or the first letter on the blend) and the name under Instagram's own top bar: top right, or top left for a
 * Latin name (owner's decision 2026-10-30; only this row flips, the rest of the story stays right to left).
 */
function drawWho(ctx, name, avatarImg, colors) {
  const size = 120;
  const latin = isLatinName(name);
  const x = latin ? 80 : W - 80 - size;
  const y = SAFE_TOP;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2 + 6, 0, Math.PI * 2);
  ctx.fillStyle = colors.ring;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  if (avatarImg) {
    drawCover(ctx, avatarImg, x, y, size, size);
  } else {
    ctx.fillStyle = blendFill(ctx, x + size, size);
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = `900 64px ${FONT}`;
    ctx.fillText((name || "ف").trim().slice(0, 1), x + size / 2, y + size / 2 + 22);
  }
  ctx.restore();
  ctx.direction = latin ? "ltr" : "rtl";
  ctx.textAlign = latin ? "left" : "right";
  ctx.fillStyle = colors.text;
  fitFont(ctx, name, 900, 56, W - 160 - size - 26);
  ctx.fillText(name, latin ? x + size + 26 : x - 26, y + size / 2 + 20);
}

/**
 * The link box at the bottom (owner's sketch 2026-10-30): «رزرو با همین لینک», an arrow, and a dashed slot where
 * Instagram's link sticker goes; the sticker covers the slot's hint. Under the words, frfro's address, small.
 */
function drawLinkBox(ctx, colors) {
  const x = 80;
  const w = W - 160;
  const y = LINK_BOX_Y;
  const mid = y + LINK_BOX_H / 2;
  roundRect(ctx, x, y, w, LINK_BOX_H, 56);
  ctx.fillStyle = colors.box;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = colors.boxLine;
  ctx.stroke();

  const label = "رزرو با همین لینک";
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.fillStyle = colors.text;
  ctx.font = `900 46px ${FONT}`;
  const labelRight = x + w - 40;
  ctx.fillText(label, labelRight, mid + 2);
  const labelW = ctx.measureText(label).width;
  ctx.fillStyle = colors.hint;
  ctx.font = `800 28px ${FONT}`;
  ctx.fillText("با فرفرو · frfro.ir", labelRight, mid + 50);
  const arrowRight = labelRight - labelW - 24;
  const arrowLeft = arrowRight - 80;
  ctx.save();
  ctx.strokeStyle = colors.arrow;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(arrowRight, mid);
  ctx.lineTo(arrowLeft, mid);
  ctx.moveTo(arrowLeft + 22, mid - 22);
  ctx.lineTo(arrowLeft, mid);
  ctx.lineTo(arrowLeft + 22, mid + 22);
  ctx.stroke();

  const slotX = x + 34;
  const slotW = arrowLeft - 22 - slotX;
  const slotH = 128;
  roundRect(ctx, slotX, mid - slotH / 2, slotW, slotH, 32);
  ctx.setLineDash([16, 12]);
  ctx.lineWidth = 5;
  ctx.strokeStyle = colors.slot;
  ctx.stroke();
  ctx.restore();
  ctx.textAlign = "center";
  ctx.fillStyle = colors.hint;
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText("برچسب لینک اینجا", slotX + slotW / 2, mid + 11);
}

/** «امروز · شنبه» / «فردا · یکشنبه ۱۰ آبان» / «پس‌فردا · دوشنبه ۱۱ آبان» */
export function dayLine(day) {
  const title = formatPersianDayTitle(day.date);
  return day.label === "امروز" ? `امروز · ${title.weekday}` : `${day.label} · ${title.full}`;
}

/**
 * The free-times story, top to bottom (owner's redesign 2026-11-01): name row (optional), a pink label, the two-line
 * headline, then each day (at most two) with its times in two columns (at most four), then the link
 * box. Everything shrinks together when it would not fit, so two full days with the name row still clear the link box.
 */
async function drawFree(ctx, { name, avatar, works, days, showWho, look, headline }) {
  const photoLook = look === "photo";
  const [photo, avatarImg] = await Promise.all([photoLook ? loadImage(works[0]?.src) : null, showWho ? loadImage(avatar) : null]);
  const colors = palette(LOOKS.find((l) => l.id === look)?.dark !== false);
  drawGround(ctx, look, photo);
  if (showWho) drawWho(ctx, name, avatarImg, colors);
  const open = days.filter((day) => day.times.length).slice(0, STORY_MAX_DAYS);
  const areaTop = photoLook ? 640 : showWho ? SAFE_TOP + 200 : SAFE_TOP + 40;
  const areaBottom = LINK_BOX_Y - 60;
  const right = W - 80;
  const width = W - 160;

  const heightAt = (k) => {
    const rows = (day) => Math.ceil(Math.min(day.times.length, STORY_TIMES_PER_DAY) / 2);
    const daysH = open.reduce((sum, day) => sum + 64 * k + rows(day) * 128 * k - 20 * k, 0) + Math.max(0, open.length - 1) * 48 * k;
    return 56 * k + 2 * 128 * k + 72 * k + daysH;
  };
  let k = 1;
  while (k > 0.66 && heightAt(k) > areaBottom - areaTop) k -= 0.02;
  let y = areaTop + Math.max(0, (areaBottom - areaTop - heightAt(k)) / 2);

  ctx.textAlign = "right";
  ctx.direction = "rtl";
  ctx.fillStyle = colors.kick;
  ctx.font = `800 ${Math.round(46 * k)}px ${FONT}`;
  ctx.fillText(open.length ? "وقت‌های خالی" : "", right, y + 44 * k);
  y += 56 * k;

  // The headline: both lines one size, the biggest that lets the longer fit; the second line in the brand blend (on
  // the light looks in deep violet, which reads on pink and on white).
  let px = Math.round(120 * k);
  for (const line of headline) {
    ctx.font = `900 ${px}px ${FONT}`;
    while (px > 48 && ctx.measureText(line).width > width) {
      px -= 4;
      ctx.font = `900 ${px}px ${FONT}`;
    }
  }
  ctx.font = `900 ${px}px ${FONT}`;
  headline.forEach((line, index) => {
    const lineY = y + 112 * k + index * 128 * k;
    ctx.fillStyle = index === 0 ? colors.text : (colors.text === "#ffffff" ? blendFill(ctx, right, ctx.measureText(line).width) : VIOLET_DEEP);
    ctx.fillText(line, right, lineY);
  });
  // No line under the headline (owner 2026-11-01: «با همین لینک، بی‌تماس و بی‌پیام» is gone); the link box says it.
  y += 2 * 128 * k + 72 * k;

  const gap = 24 * k;
  const chipW = (width - gap) / 2;
  const chipH = 108 * k;
  open.forEach((day, dayIndex) => {
    ctx.textAlign = "right";
    ctx.fillStyle = colors.text;
    ctx.font = `800 ${Math.round(40 * k)}px ${FONT}`;
    ctx.fillText(dayLine(day), right, y + 40 * k);
    y += 64 * k;
    day.times.slice(0, STORY_TIMES_PER_DAY).forEach((time, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = right - chipW - col * (chipW + gap);
      const top = y + row * 128 * k;
      roundRect(ctx, x, top, chipW, chipH, 36 * k);
      if (dayIndex === 0) {
        ctx.fillStyle = colors.chip;
        ctx.fill();
        ctx.fillStyle = colors.chipText;
      } else {
        ctx.fillStyle = colors.chip2;
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = colors.chip2Line;
        ctx.stroke();
        ctx.fillStyle = colors.chip2Text;
      }
      ctx.textAlign = "center";
      ctx.font = `900 ${Math.round(60 * k)}px ${FONT}`;
      ctx.fillText(toPersianDigits(time), x + chipW / 2, top + chipH / 2 + 21 * k);
    });
    y += Math.ceil(Math.min(day.times.length, STORY_TIMES_PER_DAY) / 2) * 128 * k - 20 * k + 48 * k;
  });
  drawLinkBox(ctx, colors);
}

/** Three of the newest works in a collage: one tall tile and two stacked beside it. */
async function drawWorks(ctx, { name, avatar, works, profileType, showWho }) {
  const colors = palette(true);
  const [avatarImg, ...pictures] = await Promise.all([showWho ? loadImage(avatar) : null, ...works.slice(0, WORKS_NEEDED).map((work) => loadImage(work.src))]);
  drawGround(ctx, "night", null);
  if (showWho) drawWho(ctx, name, avatarImg, colors);
  // Sized so the two-line headline under the collage keeps a clear gap above the link box.
  const top = showWho ? SAFE_TOP + 190 : SAFE_TOP + 40;
  const tall = showWho ? 580 : 700;
  const half = (tall - 22) / 2;
  const tiles = [
    { x: 460, y: top, w: 560, h: tall },
    { x: 60, y: top, w: 380, h: half },
    { x: 60, y: top + half + 22, w: 380, h: half }
  ];
  tiles.forEach((tile, index) => {
    ctx.save();
    roundRect(ctx, tile.x, tile.y, tile.w, tile.h, 44);
    ctx.clip();
    ctx.fillStyle = "#1c1f2b";
    ctx.fillRect(tile.x, tile.y, tile.w, tile.h);
    if (pictures[index]) drawCover(ctx, pictures[index], tile.x, tile.y, tile.w, tile.h);
    ctx.restore();
  });
  const y = top + tall + 90;
  ctx.textAlign = "right";
  ctx.direction = "rtl";
  ctx.fillStyle = PINK;
  ctx.font = `800 46px ${FONT}`;
  ctx.fillText(profileType === "salon" ? "نمونه‌کارهای ما" : "نمونه‌کارهای من", W - 80, y);
  ctx.font = `900 104px ${FONT}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText("نوبت بعدی", W - 80, y + 124);
  ctx.fillStyle = blendFill(ctx, W - 80, ctx.measureText("مال تو").width);
  ctx.fillText("مال تو", W - 80, y + 244);
  drawLinkBox(ctx, colors);
}

/**
 * The ready 9:16 story picture, drawn on a canvas, so it needs no server and is made fresh each time. Returns the
 * PNG as a Blob (to share) and a data URL (to show and save: the site's image policy admits data: but not blob: URLs).
 */
export async function drawStory(look, data) {
  if (document.fonts?.load) {
    await Promise.all([
      document.fonts.load(`900 96px Vazirmatn`),
      document.fonts.load(`800 48px Vazirmatn`),
      document.fonts.load(`700 38px Vazirmatn`)
    ]).catch(() => {});
  }
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (look === "works") await drawWorks(ctx, data);
  else await drawFree(ctx, { ...data, look });
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  return { blob, dataUrl: canvas.toDataURL("image/png") };
}
