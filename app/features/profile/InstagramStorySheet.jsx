"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Clock3, Download, Link2, RotateCcw, Sticker, Type, UserRound, X } from "lucide-react";
import { InstagramGlyph } from "../../components/InstagramFolder";
import { Spinner } from "../../components/Spinner";
import { SheetBackHandler } from "../../components/SheetClose";
import { getPosts } from "../../shared/api/posts";
import { getSalonServices, getSalonVisitTimes } from "../../shared/api/salons";
import { getArtist } from "../../shared/api/artists";
import { artistFreeTimes } from "../../shared/lib/artistFreeTimes";
import { formatPersianDateKey, formatPersianDayTitle } from "../../shared/lib/persianCalendar";
import { isTooSoonToRequest } from "../../shared/lib/bookingWindow";
import { toPersianDigits } from "../../shared/lib/digits";
import { parseServiceDurationMinutes } from "../../shared/lib/time";
import { hasNativeStoryShare, saveStoryNative, shareStoryNative } from "../../shared/lib/storyShare";
import { appTooOldFor, askForAppUpdate } from "../../shared/lib/appUpdate";
import { guideOff, guideShown, guideWanted, markPosted } from "./storyMemory";
import { STORY_MAX_DAYS, STORY_TIMES_PER_DAY, spreadTimes, suggestTimes, toggleDay, toggleTime, usableTimes } from "./storySuggestion";

// What the person hears after each button (one line each).
const SHARED_COPIED = "لینک صفحه‌ت کپی شد؛ توی استوری برچسب لینک رو بزن و بچسبون.";
const SHARED_NOT_COPIED = "توی استوری برچسب لینک رو بزن و لینک صفحه‌ت رو بذار.";
const SAVED_COPIED = "عکس ذخیره شد و لینکت کپی شد. بذارش تو استوری و برچسب لینک رو بچسبون.";
const SAVED_NOT_COPIED = "عکس ذخیره شد. بذارش تو استوری.";
const SAVE_DENIED = "برای ذخیرهٔ عکس، به فرفرو اجازهٔ دسترسی به عکس‌ها رو بده.";
const SAVE_FAILED = "عکس ذخیره نشد؛ یه بار دیگه بزن.";
const NEEDS_UPDATE = "ذخیرهٔ استوری و فرستادنش به اینستاگرام توی نسخهٔ تازه‌ست. به‌روزش کن؛ یه دقیقه طول می‌کشه.";

const W = 1080;
const H = 1920;
const INK = "#0c0d12";
const PINK = "#ff86b8";
const VIOLET_DEEP = "#5b3fd6";
const FONT = "Vazirmatn, Tahoma, sans-serif";
export const WORKS_NEEDED = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_LABELS = ["امروز", "فردا", "پس‌فردا"];
// Instagram covers about the top 12% and bottom 14% of a story with its own bars: nothing important goes there.
const SAFE_TOP = 230;
// The link box sits just above Instagram's bottom bar; everything else stays above it.
const LINK_BOX_Y = 1440;
const LINK_BOX_H = 200;
// The name row is optional (owner's decision 2026-10-30): Instagram already shows the page's own name and picture.
const WHO_KEY = "frfro-story-who";
const OPTS_KEY = "frfro-story-opts";
const MAX_TYPED = 28;
const TEXTS = [
  ["رزرو کن", "تا پر نشده"],
  ["امشب هنوز", "جا دارم"],
  ["یه وقت خالی", "برای تو"],
  ["نوبتت رو", "همین الان بگیر"]
];

/**
 * The looks, one slide each (owner's redesign 2026-11-01, https://claude.ai/artifact/FSrucn3rYLGE5DgnfJee3J): four
 * free-times looks and the works collage. Swiping changes the look; the colours of every part come from here.
 */
const LOOKS = [
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
function headlineLines(typed) {
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
async function drawStory(look, data) {
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

/** Today, tomorrow and the day after, as dates and Persian day keys. */
function nextDays() {
  const now = new Date();
  return DAY_LABELS.map((label, i) => {
    const date = new Date(now.getTime() + i * DAY_MS);
    return { label, date, key: formatPersianDateKey(date) };
  });
}

/**
 * Free start times for today, tomorrow and the day after, as a client could still request them, for the shortest
 * service. A salon asks the server (the booking rules live there); an artist's times are worked out from the public
 * page's data with the booking sheet's own rule (artistFreeTimes: working hours, workplace salon, busy list, break,
 * leaves), so the story never offers a time the sheet would not. A closed or hidden page offers nothing.
 */
export async function loadFreeSlots(profileType, profileId) {
  const days = nextDays();
  if (profileType === "salon") {
    const services = await getSalonServices();
    if (!services.ok) throw new Error("services");
    const list = services.data?.services || [];
    const shortest = [...list].sort((a, b) => (Number(a.duration) || Infinity) - (Number(b.duration) || Infinity))[0];
    if (!shortest) return days.map((day) => ({ ...day, times: [] }));
    return Promise.all(days.map(async (day) => {
      const { ok, data } = await getSalonVisitTimes(profileId, day.key, [shortest.name]);
      if (!ok) throw new Error("times");
      const times = (data?.times || []).filter((time) => !isTooSoonToRequest(day.key, time));
      return { ...day, times, service: shortest.name };
    }));
  }

  const { ok, data } = await getArtist(profileId);
  if (!ok) throw new Error("artist");
  const artist = data?.artist;
  if (!artist || !artist.isPublic || artist.onlineBookingPaused) return days.map((day) => ({ ...day, times: [] }));
  const list = artist.services || [];
  const shortest = [...list].sort((a, b) => parseServiceDurationMinutes(a.duration) - parseServiceDurationMinutes(b.duration))[0];
  if (!shortest) return days.map((day) => ({ ...day, times: [] }));
  const minutes = parseServiceDurationMinutes(shortest.duration);
  return days.map((day) => ({ ...day, service: shortest.name, times: artistFreeTimes(artist, day.key, minutes) }));
}

/** Public posts that have a picture, newest first, for the collage and the photo behind the free times. */
export async function loadWorks() {
  const res = await getPosts();
  if (!res.ok) return [];
  // The API sends `image` and `isPublic` (it used to be read as image_url, so the collage never found any work).
  return (res.data?.posts || [])
    .filter((post) => post.image && post.isPublic !== false)
    .map((post) => ({ src: post.image }));
}

const TOOLS = [
  { id: "times", label: "ساعت‌ها", Icon: Clock3 },
  { id: "text", label: "متن", Icon: Type },
  { id: "look", label: "ظاهر", Icon: UserRound }
];

/**
 * «استوری آماده», full screen (owner's redesign 2026-11-01): one big picture, swiped between looks; three tools under
 * it (times, words, look) that open one small panel at a time; one main button. frfro only suggests (owner's rule
 * 2026-11-01): the first two days that still have a time, up to four times each spread over the day, all of which the
 * person changes freely. Where the phone can share a file (the app, Chrome on Android, Safari on iPhone) the main
 * button sends it to Instagram and the side button saves it; elsewhere saving is the main button. Either way the page
 * link is copied for Instagram's link sticker, and the first three times a short guide shows how to put it on.
 */
export function InstagramStorySheet({ open, name, url, avatar = "", profileType = "", profileId = null, onClose, onNotify }) {
  const [index, setIndex] = useState(0);
  const [works, setWorks] = useState(null);
  const [slots, setSlots] = useState(null);
  const [slotsFailed, setSlotsFailed] = useState(false);
  // Drawn pictures by look id: { blob, dataUrl } or { failed: true }.
  const [made, setMade] = useState({});
  const [showWho, setShowWho] = useState(false);
  const [tool, setTool] = useState("");
  const [textIdx, setTextIdx] = useState(0);
  const [typed, setTyped] = useState("");
  // The days on the story (day keys, at most two) and the times on each.
  const [onDays, setOnDays] = useState([]);
  const [on, setOn] = useState({});
  const [suggested, setSuggested] = useState({});
  // The link guide: null, or the action to run from its button ("share" | "save" | "done").
  const [guide, setGuide] = useState(null);
  const [copied, setCopied] = useState(false);
  const railRef = useRef(null);
  // While a dot's smooth scroll runs, the rail passes the looks in between; they must not become the look.
  const goingTo = useRef(null);
  const closeRef = useRef(null);
  // The parent passes a new onClose on every render; read through a ref so the app's regular refresh (every few
  // seconds) does not re-run the load below and throw the drawn pictures away (owner's report 2026-10-30).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const looks = LOOKS.filter((l) => !l.needsWork || (works || []).length > 0);
  const look = looks[Math.min(index, looks.length - 1)] || LOOKS[0];

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setMade({});
    setWorks(null);
    setSlots(null);
    setSlotsFailed(false);
    setTool("");
    setGuide(null);
    let savedLook = "night";
    try {
      setShowWho(window.localStorage.getItem(WHO_KEY) === "1");
      const saved = JSON.parse(window.localStorage.getItem(OPTS_KEY) || "{}");
      setTextIdx(Number.isInteger(saved.textIdx) && saved.textIdx >= 0 && saved.textIdx < TEXTS.length ? saved.textIdx : 0);
      setTyped(typeof saved.typed === "string" ? saved.typed.slice(0, MAX_TYPED) : "");
      if (LOOKS.some((l) => l.id === saved.look)) savedLook = saved.look;
    } catch {
      // Nothing remembered: the ready-made choices.
    }
    setOnDays([]);
    setOn({});
    setSuggested({});
    let haveWorks = false;
    const startOn = (freeAny) => {
      // A page with no free time opens on the works; otherwise on the look used last time.
      const pool = LOOKS.filter((l) => !l.needsWork || haveWorks);
      const want = freeAny ? savedLook : "works";
      setIndex(Math.max(0, pool.findIndex((l) => l.id === want)));
    };
    const worksLoad = loadWorks().catch(() => []).then((list) => { haveWorks = list.length > 0; if (!cancelled) setWorks(list); });
    const slotsLoad = profileId && (profileType === "salon" || profileType === "artist")
      ? loadFreeSlots(profileType, profileId).catch(() => { if (!cancelled) setSlotsFailed(true); return []; })
      : Promise.resolve([]);
    Promise.all([worksLoad, slotsLoad]).then(([, days]) => {
      if (cancelled) return;
      const now = new Date();
      const usable = days.map((day) => ({ ...day, times: usableTimes(day, now) }));
      const picks = suggestTimes(usable, now);
      setSlots(usable);
      setSuggested(picks);
      setOn(picks);
      setOnDays(Object.keys(picks));
      startOn(usable.some((day) => day.times.length));
    });
    const raf = requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }));
    const onKey = (event) => { if (event.key === "Escape") onCloseRef.current?.(); };
    document.addEventListener("keydown", onKey);
    return () => { cancelled = true; cancelAnimationFrame(raf); document.removeEventListener("keydown", onKey); };
  }, [open, profileType, profileId]);

  // Put the rail on the chosen look once the slides exist.
  useEffect(() => {
    if (!open || works === null || slots === null) return;
    const slide = railRef.current?.children[index];
    slide?.scrollIntoView({ behavior: "instant", inline: "center", block: "nearest" });
    // Only when the data first arrives; swiping moves the rail itself.
  }, [open, works === null, slots === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const shownDays = (slots || [])
    .filter((day) => onDays.includes(day.key))
    .map((day) => ({ ...day, times: [...(on[day.key] || [])].sort() }))
    .filter((day) => day.times.length);
  const hasFree = (slots || []).some((day) => day.times.length);
  const headline = typed.trim() ? headlineLines(typed) : TEXTS[textIdx];
  const worksReady = works !== null && works.length >= WORKS_NEEDED;
  const dataReady = works !== null && slots !== null;

  function problemFor(l) {
    if (!dataReady) return "";
    if (l.kind === "works") return worksReady ? "" : `برای این استوری دست‌کم ${toPersianDigits(WORKS_NEEDED)} تا نمونه‌کار بذار.`;
    if (slotsFailed) return "وقت‌های خالیت رو نتونستیم بخونیم؛ یه بار دیگه باز کن.";
    if (!hasFree) return "این سه روز وقت خالی نداری. نمونه‌کارهات رو استوری کن.";
    if (!shownDays.length) return "یه روز و یه ساعت رو روشن کن.";
    return "";
  }

  const problem = problemFor(look);
  useEffect(() => {
    if (!open || !dataReady || problem || made[look.id]) return undefined;
    let cancelled = false;
    drawStory(look.id, { name: name || "فرفرو", avatar, works: works || [], days: shownDays, profileType, showWho, headline })
      .then((picture) => { if (!cancelled) setMade((all) => ({ ...all, [look.id]: picture.blob ? picture : { failed: true } })); })
      .catch(() => { if (!cancelled) setMade((all) => ({ ...all, [look.id]: { failed: true } })); });
    return () => { cancelled = true; };
    // shownDays, headline: derived from on, onDays, typed and textIdx, which are listed.
  }, [open, look.id, dataReady, problem, made, name, avatar, works, slots, profileType, showWho, on, onDays, typed, textIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  function remember(next) {
    try {
      window.localStorage.setItem(OPTS_KEY, JSON.stringify({ textIdx, typed, look: look.id, ...next }));
    } catch {
      // Private mode: the choice just lasts while the sheet is open.
    }
  }

  function redraw() {
    setMade({});
  }

  function setWho(next) {
    setShowWho(next);
    redraw();
    try {
      window.localStorage.setItem(WHO_KEY, next ? "1" : "0");
    } catch {
      // Private mode: the choice just lasts while the sheet is open.
    }
  }

  function flipDay(key) {
    const order = (slots || []).map((day) => day.key);
    const next = toggleDay(onDays, key, order);
    setOnDays(next);
    // A day turned on for the first time starts with frfro's spread of its times.
    if (next.includes(key) && !(on[key] || []).length) {
      const day = (slots || []).find((d) => d.key === key);
      setOn((all) => ({ ...all, [key]: spreadTimes(day?.times || []) }));
    }
    redraw();
  }

  function flipTime(dayKey, time) {
    setOn((all) => ({ ...all, [dayKey]: toggleTime(all[dayKey], time) }));
    redraw();
  }

  function resetSuggestion() {
    setOn(suggested);
    setOnDays(Object.keys(suggested));
    redraw();
  }

  if (!open || typeof document === "undefined") return null;

  const picture = made[look.id];
  const preview = picture?.dataUrl || "";
  const file = picture?.blob ? new File([picture.blob], "frfro-story.png", { type: "image/png" }) : null;
  // Inside the Android app the app itself shares and saves (storyShare.js); the WebView can do neither.
  const native = hasNativeStoryShare();
  // An app from before StorySharePlugin can do neither; it would only pretend to save (2026-10-30), so it asks for the update.
  const oldApp = !native && appTooOldFor("StoryShare");
  // Asked of a stand-in file, so the buttons keep their places while a picture is still being drawn.
  const canShareFile = native || oldApp || (typeof navigator !== "undefined" && Boolean(navigator.canShare?.({ files: [file || new File([""], "frfro-story.png", { type: "image/png" })] })));

  function onRailScroll() {
    const rail = railRef.current;
    const first = rail?.children[0];
    if (!first) return;
    // RTL rails scroll to negative values in Chrome and Safari; the distance is what counts.
    const next = Math.max(0, Math.min(looks.length - 1, Math.round(Math.abs(rail.scrollLeft) / first.offsetWidth)));
    if (goingTo.current) {
      if (next === goingTo.current.i || Date.now() > goingTo.current.until) goingTo.current = null;
      return;
    }
    if (next !== index) {
      setIndex(next);
      remember({ look: looks[next].id });
      if (looks[next].kind === "works" && tool !== "look") setTool("");
    }
  }

  function goTo(i) {
    goingTo.current = { i, until: Date.now() + 1500 };
    if (looks[i].kind === "works" && tool !== "look") setTool("");
    railRef.current?.children[i]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    setIndex(i);
    remember({ look: looks[i].id });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  }

  const postedNow = () => markPosted();
  const sharedNote = (ok) => (ok ? SHARED_COPIED : SHARED_NOT_COPIED);
  const savedNote = (ok) => (ok ? SAVED_COPIED : SAVED_NOT_COPIED);

  // Copies the link and opens the phone's share list; Instagram's «استوری» there opens the story editor with the picture.
  async function share() {
    if (oldApp) {
      askForAppUpdate(NEEDS_UPDATE);
      return;
    }
    if (native) {
      try {
        const result = await shareStoryNative(preview, url);
        postedNow();
        onNotify?.(sharedNote(result.copied));
      } catch {
        save();
      }
      return;
    }
    const ok = await copyLink();
    try {
      await navigator.share({ files: [file] });
      postedNow();
      onNotify?.(sharedNote(ok));
    } catch (error) {
      if (error?.name !== "AbortError") save();
    }
  }

  // Saves the picture (to the gallery in the app) and copies the link.
  async function save() {
    if (!preview) return;
    if (oldApp) {
      askForAppUpdate(NEEDS_UPDATE);
      return;
    }
    if (native) {
      try {
        const result = await saveStoryNative(preview, url);
        postedNow();
        onNotify?.(savedNote(result.copied));
      } catch (error) {
        onNotify?.(error?.code === "DENIED" ? SAVE_DENIED : SAVE_FAILED);
      }
      return;
    }
    const a = document.createElement("a");
    a.href = preview;
    a.download = "frfro-story.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    postedNow();
    onNotify?.(savedNote(await copyLink()));
  }

  // The first few times, the guide comes first; its own button then shares or saves (a tap, so the phone allows it).
  async function start(action) {
    if (!preview) return;
    if (oldApp) {
      askForAppUpdate(NEEDS_UPDATE);
      return;
    }
    if (guideWanted()) {
      setCopied(await copyLink());
      guideShown();
      setGuide(action);
      return;
    }
    if (action === "share") share();
    else save();
  }

  function fromGuide() {
    const action = guide;
    setGuide(null);
    if (action === "share") share();
    else save();
  }

  function slideBody(slide) {
    const own = made[slide.id];
    const why = problemFor(slide);
    if (own?.dataUrl) return <img src={own.dataUrl} alt={`استوری ${slide.label} ${name}`} />;
    if (own?.failed) return <p className="igStudioNote">عکس ساخته نشد؛ یه بار دیگه باز کن.</p>;
    if (why) {
      const toWorks = slide.kind === "free" && !hasFree && !slotsFailed && worksReady;
      return (
        <div className="igStudioEmpty">
          <p className="igStudioNote">{why}</p>
          {toWorks ? <button type="button" onClick={() => goTo(looks.findIndex((l) => l.id === "works"))}>برو به نمونه‌کارها</button> : null}
        </div>
      );
    }
    return <Spinner size={40} />;
  }

  const freeLook = look.kind === "free";
  const tools = TOOLS.filter((t) => freeLook || t.id === "look");
  const activeTool = tools.some((t) => t.id === tool) ? tool : "";

  return createPortal((
    <div className="igStudio" role="dialog" aria-modal="true" aria-label="استوری آماده">
      <div className="igStudioTop">
        <button type="button" ref={closeRef} className="igStudioClose" onClick={onClose} aria-label="بستن استوری آماده">
          <X size={20} aria-hidden="true" />
        </button>
        <b className="igStudioTitle">استوری</b>
        {/* No «·» beside a number here: it reads as the Persian zero («۱۰ از ۵»). */}
        <span className="igStudioCount" aria-live="polite"><b>{look.label}</b><small>{toPersianDigits(index + 1)} از {toPersianDigits(looks.length)}</small></span>
      </div>

      <div className="igStudioRail" ref={railRef} onScroll={onRailScroll}>
        {looks.map((slide, i) => (
          <div key={slide.id} className="igStudioSlide" aria-hidden={i !== index}>
            <div className="igStudioPicture">{works === null || slots === null ? <Spinner size={40} /> : slideBody(slide)}</div>
          </div>
        ))}
      </div>

      <div className="igStudioLooks" role="tablist" aria-label="ظاهر استوری">
        {looks.map((slide, i) => (
          <button key={slide.id} type="button" role="tab" aria-selected={i === index} aria-label={slide.label} className={`igLookDot is-${slide.id}${i === index ? " is-on" : ""}`} onClick={() => goTo(i)} />
        ))}
      </div>

      {activeTool ? (
        <div className="igStudioPanel" role="group" aria-label={TOOLS.find((t) => t.id === activeTool)?.label}>
          {activeTool === "times" ? (
            hasFree ? (
              <div className="igEditBlock">
                <div className="igDays" role="group" aria-label="روزها">
                  {(slots || []).map((day) => {
                    const isOn = onDays.includes(day.key);
                    const none = !day.times.length;
                    return (
                      <button key={day.key} type="button" className={isOn ? "is-on" : ""} aria-pressed={isOn} disabled={none} onClick={() => flipDay(day.key)}>
                        <b>{day.label}</b>
                        <small>{none ? "وقت خالی نداره" : `${toPersianDigits(day.times.length)} وقت`}</small>
                      </button>
                    );
                  })}
                </div>
                <small className="igEditHint"><CalendarDays size={13} aria-hidden="true" /> تا {toPersianDigits(STORY_MAX_DAYS)} روز، هر روز تا {toPersianDigits(STORY_TIMES_PER_DAY)} ساعت. نقطهٔ بنفش یعنی پیشنهاد ما.</small>
                {(slots || []).filter((day) => onDays.includes(day.key) && day.times.length).map((day) => (
                  <div className="igEditDay" key={day.key}>
                    <div className="igEditDayHead">
                      <span>{dayLine(day)}</span>
                      <small>{toPersianDigits((on[day.key] || []).length)} از {toPersianDigits(STORY_TIMES_PER_DAY)}</small>
                    </div>
                    <div className="igEditChips">
                      {day.times.map((time) => {
                        const isOn = (on[day.key] || []).includes(time);
                        const full = !isOn && (on[day.key] || []).length >= STORY_TIMES_PER_DAY;
                        return (
                          <button key={time} type="button" className={`${isOn ? "is-on" : ""}${(suggested[day.key] || []).includes(time) ? " is-suggested" : ""}`} aria-pressed={isOn} disabled={full} onClick={() => flipTime(day.key, time)}>
                            {toPersianDigits(time)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <button type="button" className="igEditReset" onClick={resetSuggestion}><RotateCcw size={14} aria-hidden="true" /> برگرد به پیشنهاد ما</button>
              </div>
            ) : <p className="igEditHint">این سه روز وقت خالی نداری.</p>
          ) : null}
          {activeTool === "text" ? (
            <div className="igEditBlock">
              <div className="igEditList">
                {TEXTS.map((lines, i) => (
                  <button key={lines.join(" ")} type="button" className={!typed.trim() && i === textIdx ? "is-on" : ""} onClick={() => { setTextIdx(i); setTyped(""); redraw(); remember({ textIdx: i, typed: "" }); }}>
                    {lines.join(" ")}
                  </button>
                ))}
              </div>
              <input
                type="text"
                className="igEditInput"
                value={typed}
                maxLength={MAX_TYPED}
                placeholder="یا خودت بنویس…"
                aria-label="متن دلخواه"
                onChange={(event) => { const value = event.target.value.slice(0, MAX_TYPED); setTyped(value); redraw(); remember({ typed: value }); }}
              />
              <small className="igEditHint">تا {toPersianDigits(MAX_TYPED)} حرف؛ خودش دو خط می‌شه.</small>
            </div>
          ) : null}
          {activeTool === "look" ? (
            <div className="igEditBlock">
              <button type="button" className="igSwitchRow" role="switch" aria-checked={showWho} onClick={() => setWho(!showWho)}>
                <span>اسم و عکس پروفایل</span>
                <i className={showWho ? "is-on" : ""} aria-hidden="true" />
              </button>
              <small className="igEditHint">رنگ رو با کشیدن عکس به چپ و راست عوض کن.</small>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="igStudioTools" role="toolbar" aria-label="ابزارها">
        {tools.map(({ id, label, Icon }) => (
          <button key={id} type="button" className={activeTool === id ? "is-on" : ""} aria-pressed={activeTool === id} onClick={() => setTool(activeTool === id ? "" : id)}>
            <span aria-hidden="true"><Icon size={18} /></span>
            {label}
          </button>
        ))}
      </div>

      <div className="igStudioBar">
        <button type="button" className="igStudioMain" disabled={!preview} onClick={() => start(canShareFile ? "share" : "save")}>
          {canShareFile ? <InstagramGlyph size={19} /> : <Download size={19} aria-hidden="true" />}
          {canShareFile ? "بفرست به اینستاگرام" : "ذخیره عکس"}
        </button>
        {canShareFile ? (
          <button type="button" className="igStudioSave" disabled={!preview} onClick={() => start("save")} aria-label="ذخیره عکس">
            <Download size={20} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {guide ? (
        <div className="igGuideBack" onClick={() => setGuide(null)}>
          <div className="igGuide" role="dialog" aria-modal="true" aria-labelledby="igGuideTitle" onClick={(event) => event.stopPropagation()}>
            <p className={`igGuideCopied${copied ? "" : " is-not"}`}><Link2 size={16} aria-hidden="true" /> {copied ? "لینک صفحه‌ت کپی شد" : "لینک کپی نشد؛ از دکمهٔ «کپی لینک» توی تنظیمات اینستاگرام بردار"}</p>
            <h3 id="igGuideTitle">توی اینستاگرام این سه کار رو بکن</h3>
            <ol className="igGuideSteps">
              <li><b>۱</b><span><Sticker size={18} aria-hidden="true" /></span>برچسب‌ها رو باز کن</li>
              <li><b>۲</b><span className="igGuideLink">LINK</span>«لینک» رو بزن</li>
              <li><b>۳</b><span className="igGuideSlot" aria-hidden="true" />بچسبون و بذارش روی کادر</li>
            </ol>
            <button type="button" className="igStudioMain" onClick={fromGuide}>
              {guide === "share" ? <InstagramGlyph size={19} /> : <Download size={19} aria-hidden="true" />}
              {guide === "share" ? "برو به اینستاگرام" : "ذخیرهٔ عکس"}
            </button>
            <button type="button" className="igGuideOff" onClick={() => { guideOff(); fromGuide(); }}>دیگه نشونم نده</button>
          </div>
        </div>
      ) : null}
      <SheetBackHandler onClose={guide ? () => setGuide(null) : onClose} />
    </div>
  ), document.body);
}
