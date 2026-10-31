"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Download, X } from "lucide-react";
import { InstagramGlyph } from "../../components/InstagramFolder";
import { Spinner } from "../../components/Spinner";
import { SheetBackHandler } from "../../components/SheetClose";
import { getPosts } from "../../shared/api/posts";
import { getSalonServices, getSalonVisitTimes } from "../../shared/api/salons";
import { getArtist } from "../../shared/api/artists";
import { artistVisitTimes } from "../booking/artistVisitTimes";
import { formatPersianDateKey, formatPersianDayTitle } from "../../shared/lib/persianCalendar";
import { isTooSoonToRequest } from "../../shared/lib/bookingWindow";
import { toPersianDigits } from "../../shared/lib/digits";
import { parseServiceDurationMinutes } from "../../shared/lib/time";
import { hasNativeStoryShare, saveStoryNative, shareStoryNative } from "../../shared/lib/storyShare";
import { appTooOldFor, askForAppUpdate } from "../../shared/lib/appUpdate";

// What the person hears after each button (one line each).
const SHARED_COPIED = "لینک صفحه‌ت کپی شد؛ توی استوری برچسب لینک رو بزن و بچسبون.";
const SHARED_NOT_COPIED = "توی استوری برچسب لینک رو بزن و لینک صفحه‌ت رو بذار.";
const SAVED_COPIED = "عکس ذخیره شد و لینکت کپی شد. بذارش تو استوری و برچسب لینک رو بچسبون.";
const SAVED_NOT_COPIED = "عکس ذخیره شد. بذارش تو استوری.";
const SAVE_DENIED = "برای ذخیره‌ی عکس، به فرفرو اجازه‌ی دسترسی به عکس‌ها رو بده.";
const SAVE_FAILED = "عکس ذخیره نشد؛ یه بار دیگه بزن.";
const NEEDS_UPDATE = "ذخیرهٔ استوری و فرستادنش به اینستاگرام توی نسخهٔ تازه‌ست. به‌روزش کن؛ یه دقیقه طول می‌کشه.";

const W = 1080;
const H = 1920;
const INK = "#0c0d12";
const PINK = "#ff86b8";
const VIOLET = "#8b6cff";
const FONT = "Vazirmatn, Tahoma, sans-serif";
export const WORKS_NEEDED = 3;
// Three big chips a day read at a glance on a story; more turn into small print (owner's redesign 2026-10-29).
const SLOTS_PER_DAY = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
// Instagram covers about the top 14% and bottom 14% of a story with its own bars: nothing important goes there.
const SAFE_TOP = 230;
// The link box sits just above Instagram's bottom bar; everything else stays above it.
const LINK_BOX_Y = 1450;
const LINK_BOX_H = 190;
// The name row is optional (owner's decision 2026-10-30): Instagram already shows the page's own name and picture.
const WHO_KEY = "frfro-story-who";

// Free slots first (what fills the chair), then the works. No QR and no portrait (owner's decision 2026-10-29):
// the link goes on the story as Instagram's own link sticker, so the picture stays clean.
const DESIGNS = [
  { id: "free", label: "نوبت خالی" },
  { id: "works", label: "نمونه‌کار" }
];

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

function glow(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(12,13,18,0)");
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

/** Ink ground; a work photo across the top fading into the ink when there is one, otherwise two soft glows. */
function drawGround(ctx, photo, photoHeight) {
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  if (photo) {
    drawCover(ctx, photo, 0, 0, W, photoHeight);
    const fade = ctx.createLinearGradient(0, photoHeight * 0.42, 0, photoHeight);
    fade.addColorStop(0, "rgba(12,13,18,0)");
    fade.addColorStop(0.6, "rgba(12,13,18,0.82)");
    fade.addColorStop(1, INK);
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, W, photoHeight);
    const top = ctx.createLinearGradient(0, 0, 0, 420);
    top.addColorStop(0, "rgba(12,13,18,0.55)");
    top.addColorStop(1, "rgba(12,13,18,0)");
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, 420);
  } else {
    glow(ctx, 160, 300, 820, "rgba(255,134,184,0.34)");
    glow(ctx, 960, 1500, 860, "rgba(139,108,255,0.38)");
  }
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
function drawWho(ctx, name, avatarImg) {
  const size = 128;
  const latin = isLatinName(name);
  const x = latin ? 80 : W - 80 - size;
  const y = SAFE_TOP;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2 + 6, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
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
    ctx.font = `900 68px ${FONT}`;
    ctx.fillText((name || "ف").trim().slice(0, 1), x + size / 2, y + size / 2 + 24);
  }
  ctx.restore();
  ctx.direction = latin ? "ltr" : "rtl";
  ctx.textAlign = latin ? "left" : "right";
  ctx.fillStyle = "#ffffff";
  fitFont(ctx, name, 900, 58, W - 160 - size - 26);
  ctx.fillText(name, latin ? x + size + 26 : x - 26, y + size / 2 + 20);
}

function drawKick(ctx, text, y, right = W - 80) {
  ctx.textAlign = "right";
  ctx.direction = "rtl";
  ctx.fillStyle = PINK;
  ctx.font = `800 46px ${FONT}`;
  ctx.fillText(text, right, y);
}

/**
 * Big lines ending at `right`: the first white, the rest in the blend. All lines share one size (the biggest that lets
 * the longest fit), so the headline reads as one block. Returns the y of the last line.
 */
function drawHeadline(ctx, lines, y, size, right = W - 80, maxWidth = W - 160, lineHeight = 1.1) {
  ctx.textAlign = "right";
  ctx.direction = "rtl";
  let px = size;
  lines.forEach((line) => {
    let fit = size;
    ctx.font = `900 ${fit}px ${FONT}`;
    while (fit > 40 && ctx.measureText(line).width > maxWidth) {
      fit -= 4;
      ctx.font = `900 ${fit}px ${FONT}`;
    }
    px = Math.min(px, fit);
  });
  ctx.font = `900 ${px}px ${FONT}`;
  lines.forEach((line, index) => {
    ctx.fillStyle = index === 0 ? "#ffffff" : blendFill(ctx, right, ctx.measureText(line).width);
    ctx.fillText(line, right, y + index * px * lineHeight);
  });
  return y + (lines.length - 1) * px * lineHeight;
}

/**
 * The link box at the bottom (owner's sketch 2026-10-30): «رزرو با همین لینک», an arrow, and a dashed slot where
 * Instagram's link sticker goes; the sticker covers the slot's hint.
 */
function drawLinkBox(ctx) {
  const x = 80;
  const w = W - 160;
  const y = LINK_BOX_Y;
  const mid = y + LINK_BOX_H / 2;
  roundRect(ctx, x, y, w, LINK_BOX_H, 52);
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.stroke();

  const label = "رزرو با همین لینک";
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 46px ${FONT}`;
  const labelRight = x + w - 38;
  ctx.fillText(label, labelRight, mid + 16);
  const arrowRight = labelRight - ctx.measureText(label).width - 24;
  const arrowLeft = arrowRight - 84;
  ctx.save();
  ctx.strokeStyle = PINK;
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
  const slotH = 124;
  roundRect(ctx, slotX, mid - slotH / 2, slotW, slotH, 30);
  ctx.setLineDash([16, 12]);
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(255,134,184,0.85)";
  ctx.stroke();
  ctx.restore();
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = `700 32px ${FONT}`;
  ctx.fillText("برچسب لینک اینجا", slotX + slotW / 2, mid + 11);
}

/** «امروز · پنجشنبه» / «فردا · شنبه ۹ آبان» */
function dayLine(day) {
  const title = formatPersianDayTitle(day.date);
  return day.label === "امروز" ? `امروز · ${title.weekday}` : `فردا · ${title.full}`;
}

/**
 * Several free times (owner's sketch 2026-10-30): the times in one column on the right, three a day stacked (today's
 * white, tomorrow's outlined), and the words beside them; the link box underneath.
 */
async function drawFree(ctx, { name, avatar, works, days, showWho }) {
  const [photo, avatarImg] = await Promise.all([loadImage(works[0]?.src), showWho ? loadImage(avatar) : null]);
  drawGround(ctx, photo, 620);
  if (showWho) drawWho(ctx, name, avatarImg);
  const open = days.filter((day) => day.times.length);
  const colW = 400;
  const chipH = 104;
  const chipGap = 18;
  const labelH = 62;
  const dayGap = 40;
  const dayH = (day) => labelH + Math.min(day.times.length, SLOTS_PER_DAY) * (chipH + chipGap) - chipGap;
  const timesH = open.reduce((sum, day) => sum + dayH(day), 0) + dayGap * Math.max(0, open.length - 1);
  const textH = 470;
  const areaTop = showWho ? SAFE_TOP + 218 : SAFE_TOP + 20;
  const areaBottom = LINK_BOX_Y - 70;
  const blockH = Math.max(timesH, textH);
  const top = areaTop + Math.max(0, (areaBottom - areaTop - blockH) / 2);

  let y = top + (blockH - timesH) / 2;
  const chipX = W - 80 - colW;
  open.forEach((day, dayIndex) => {
    ctx.textAlign = "right";
    ctx.direction = "rtl";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = `800 40px ${FONT}`;
    ctx.fillText(dayLine(day), W - 80, y + 40);
    let chipY = y + labelH;
    day.times.slice(0, SLOTS_PER_DAY).forEach((time) => {
      roundRect(ctx, chipX, chipY, colW, chipH, 34);
      if (dayIndex === 0) {
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.fillStyle = INK;
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
      }
      ctx.textAlign = "center";
      ctx.font = `900 58px ${FONT}`;
      ctx.fillText(toPersianDigits(time), chipX + colW / 2, chipY + 73);
      chipY += chipH + chipGap;
    });
    y += dayH(day) + dayGap;
  });

  const textRight = chipX - 44;
  const textWidth = textRight - 80;
  const textTop = top + (blockH - textH) / 2;
  // One block, three steps: a small pink label, a two-line headline of one size, a quiet two-line note. Spacing is
  // even (about 70 px between steps) so nothing floats apart (owner's typography fix 2026-10-31).
  drawKick(ctx, "وقت‌های خالی", textTop + 44, textRight);
  const last = drawHeadline(ctx, ["رزرو کن", "تا پر نشده"], textTop + 190, 112, textRight, textWidth, 1.2);
  ctx.textAlign = "right";
  ctx.direction = "rtl";
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = `700 36px ${FONT}`;
  ctx.fillText("با همین لینک،", textRight, last + 84);
  ctx.fillText("بی‌تماس و بی‌پیام.", textRight, last + 138);
  drawLinkBox(ctx);
}

/** Exactly one free time (a cancellation, say): the time itself, huge, with the service under it. */
async function drawOneFree(ctx, { name, avatar, works, day, showWho }) {
  const [photo, avatarImg] = await Promise.all([loadImage(works[0]?.src), showWho ? loadImage(avatar) : null]);
  drawGround(ctx, photo, 1000);
  if (!photo) glow(ctx, 1000, 1700, 700, "rgba(139,108,255,0.4)");
  if (showWho) drawWho(ctx, name, avatarImg);
  const y = photo ? 820 : 720;
  drawKick(ctx, "یه وقت خالی شد", y);
  ctx.textAlign = "right";
  ctx.direction = "rtl";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = `800 52px ${FONT}`;
  ctx.fillText(dayLine(day), W - 80, y + 84);
  const time = toPersianDigits(day.times[0]);
  ctx.font = `900 300px ${FONT}`;
  ctx.fillStyle = blendFill(ctx, W - 80, ctx.measureText(time).width);
  ctx.fillText(time, W - 80, y + 400);
  if (day.service) {
    fitFont(ctx, day.service, 800, 46, W - 260);
    const w = ctx.measureText(day.service).width + 84;
    roundRect(ctx, W - 80 - w, y + 460, w, 92, 46);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.fillText(day.service, W - 80 - 42, y + 522);
  }
  drawLinkBox(ctx);
}

/** Three of the newest works in a collage: one tall tile and two stacked beside it. */
async function drawWorks(ctx, { name, avatar, works, profileType, showWho }) {
  const [avatarImg, ...pictures] = await Promise.all([showWho ? loadImage(avatar) : null, ...works.slice(0, WORKS_NEEDED).map((work) => loadImage(work.src))]);
  drawGround(ctx, null, 0);
  if (showWho) drawWho(ctx, name, avatarImg);
  const top = showWho ? SAFE_TOP + 190 : SAFE_TOP + 40;
  const tall = showWho ? 660 : 780;
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
  const y = top + tall + 100;
  drawKick(ctx, profileType === "salon" ? "نمونه‌کارهای ما" : "نمونه‌کارهای من", y);
  drawHeadline(ctx, ["نوبت بعدی", "مال تو"], y + 116, 96);
  drawLinkBox(ctx);
}

/**
 * The ready 9:16 story picture, drawn on a canvas, so it needs no server and is made fresh each time. Returns the
 * PNG as a Blob (to share) and a data URL (to show and save: the site's image policy admits data: but not blob: URLs).
 */
async function drawStory(design, data) {
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
  if (design === "works") {
    await drawWorks(ctx, data);
  } else {
    const open = data.days.filter((day) => day.times.length);
    const total = open.reduce((sum, day) => sum + day.times.length, 0);
    if (total === 1) await drawOneFree(ctx, { ...data, day: open[0] });
    else await drawFree(ctx, data);
  }
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  return { blob, dataUrl: canvas.toDataURL("image/png") };
}

/** Today and tomorrow, as dates and Persian day keys. */
function todayAndTomorrow() {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + DAY_MS);
  return [
    { label: "امروز", date: now, key: formatPersianDateKey(now) },
    { label: "فردا", date: tomorrow, key: formatPersianDateKey(tomorrow) }
  ];
}

/**
 * Free start times for today and tomorrow, as a client could still request them, for the shortest service (named
 * on the one-slot story). A salon asks the server (the booking rules live there); an artist's times are worked out
 * from the public page's own busy list, break and leaves, the same as its booking page. A closed or hidden page
 * offers nothing.
 */
export async function loadFreeSlots(profileType, profileId) {
  const days = todayAndTomorrow();
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
  return days.map((day) => ({
    ...day,
    service: shortest.name,
    times: artistVisitTimes({
      day: day.key,
      minutes,
      bookedSlots: artist.bookedSlots || [],
      breakTime: artist.breakTime || null,
      leaves: artist.leaves || []
    })
  }));
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

/** What the free-times story is short of, in the words its slide shows; "" when it can be made. */
function freeProblem(slots, failed) {
  if (failed) return "وقت‌های خالیت رو نتونستیم بخونیم؛ یه بار دیگه باز کن.";
  if (slots && !slots.some((day) => day.times.length)) return "امروز و فردا وقت خالی نداری. نمونه‌کارهات رو استوری کن.";
  return "";
}

/**
 * «استوری آماده», full screen (owner's redesign 2026-10-29): the story fills the screen, the two designs sit side by
 * side (swipe, or tap their names on top), and the bottom holds only the buttons. Where the phone can share a file
 * (Chrome on Android, Safari on iPhone) «بفرست به اینستاگرام» opens the share list with Instagram in it and the
 * download button saves the picture; elsewhere saving is the main button. Either way the page link is copied, so
 * it can go straight onto Instagram's link sticker.
 */
export function InstagramStorySheet({ open, name, url, avatar = "", profileType = "", profileId = null, onClose, onNotify }) {
  const [index, setIndex] = useState(0);
  const [works, setWorks] = useState(null);
  const [slots, setSlots] = useState(null);
  const [slotsFailed, setSlotsFailed] = useState(false);
  // Drawn pictures by design id: { blob, dataUrl } or { failed: true }.
  const [made, setMade] = useState({});
  // Off unless the person turned it on before (owner's decision 2026-10-30).
  const [showWho, setShowWho] = useState(false);
  const railRef = useRef(null);
  const closeRef = useRef(null);
  // The parent passes a new onClose on every render; read through a ref so the app's regular refresh (every few
  // seconds) does not re-run the load below and throw the drawn pictures away (owner's report 2026-10-30).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const design = DESIGNS[index]?.id || "free";

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setIndex(0);
    setMade({});
    setWorks(null);
    setSlots(null);
    setSlotsFailed(false);
    try {
      setShowWho(window.localStorage.getItem(WHO_KEY) === "1");
    } catch {
      setShowWho(false);
    }
    loadWorks()
      .then((list) => { if (!cancelled) setWorks(list); })
      .catch(() => { if (!cancelled) setWorks([]); });
    if (profileId && (profileType === "salon" || profileType === "artist")) {
      loadFreeSlots(profileType, profileId)
        .then((days) => { if (!cancelled) setSlots(days); })
        .catch(() => { if (!cancelled) { setSlotsFailed(true); setSlots([]); } });
    } else {
      setSlots([]);
    }
    const raf = requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }));
    const onKey = (event) => { if (event.key === "Escape") onCloseRef.current?.(); };
    document.addEventListener("keydown", onKey);
    return () => { cancelled = true; cancelAnimationFrame(raf); document.removeEventListener("keydown", onKey); };
  }, [open, profileType, profileId]);

  const worksReady = works !== null && works.length >= WORKS_NEEDED;
  const dataReady = works !== null && slots !== null;
  const problems = {
    free: dataReady ? freeProblem(slots, slotsFailed) : "",
    works: works !== null && !worksReady ? `برای این استوری دست‌کم ${toPersianDigits(WORKS_NEEDED)} تا نمونه‌کار بذار.` : ""
  };

  useEffect(() => {
    if (!open || !dataReady || problems[design] || made[design]) return undefined;
    let cancelled = false;
    drawStory(design, { name: name || "فرفرو", avatar, works: works || [], days: slots || [], profileType, showWho })
      .then((picture) => { if (!cancelled) setMade((all) => ({ ...all, [design]: picture.blob ? picture : { failed: true } })); })
      .catch(() => { if (!cancelled) setMade((all) => ({ ...all, [design]: { failed: true } })); });
    return () => { cancelled = true; };
    // problems[design] is derived from works/slots, which are listed.
  }, [open, design, dataReady, made, name, avatar, works, slots, slotsFailed, profileType, showWho]);

  function toggleWho() {
    const next = !showWho;
    setShowWho(next);
    setMade({});
    try {
      window.localStorage.setItem(WHO_KEY, next ? "1" : "0");
    } catch {
      // Private mode: the choice just lasts while the sheet is open.
    }
  }

  if (!open || typeof document === "undefined") return null;

  const picture = made[design];
  const preview = picture?.dataUrl || "";
  const file = picture?.blob ? new File([picture.blob], "frfro-story.png", { type: "image/png" }) : null;
  // Asked of a stand-in file, so the buttons keep their places while a picture is still being drawn.
  // Inside the Android app the app itself shares and saves (storyShare.js); the WebView can do neither.
  const native = hasNativeStoryShare();
  // An app from before StorySharePlugin can do neither; it would only pretend to save (2026-10-30), so it asks for the update.
  const oldApp = !native && appTooOldFor("StoryShare");
  const canShareFile = native || oldApp || (typeof navigator !== "undefined" && Boolean(navigator.canShare?.({ files: [file || new File([""], "frfro-story.png", { type: "image/png" })] })));

  function onRailScroll() {
    const rail = railRef.current;
    const first = rail?.children[0];
    if (!first) return;
    // RTL rails scroll to negative values in Chrome and Safari; the distance is what counts.
    const next = Math.max(0, Math.min(DESIGNS.length - 1, Math.round(Math.abs(rail.scrollLeft) / first.offsetWidth)));
    if (next !== index) setIndex(next);
  }

  function goTo(i) {
    railRef.current?.children[i]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    setIndex(i);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  }

  const sharedNote = (copied) => (copied ? SHARED_COPIED : SHARED_NOT_COPIED);
  const savedNote = (copied) => (copied ? SAVED_COPIED : SAVED_NOT_COPIED);

  // Copies the link and opens the phone's share list; Instagram's «استوری» there opens the story editor with the picture.
  async function share() {
    if (oldApp) {
      askForAppUpdate(NEEDS_UPDATE);
      return;
    }
    if (native) {
      try {
        const { copied } = await shareStoryNative(preview, url);
        onNotify?.(sharedNote(copied));
      } catch {
        save();
      }
      return;
    }
    const copied = await copyLink();
    try {
      await navigator.share({ files: [file] });
      onNotify?.(sharedNote(copied));
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
        const { copied } = await saveStoryNative(preview, url);
        onNotify?.(savedNote(copied));
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
    onNotify?.(savedNote(await copyLink()));
  }

  function slideBody(slide) {
    const own = made[slide.id];
    if (own?.dataUrl) return <img src={own.dataUrl} alt={`استوری ${slide.label} ${name}`} />;
    if (own?.failed) return <p className="igStudioNote">عکس ساخته نشد؛ یه بار دیگه باز کن.</p>;
    if (problems[slide.id]) return <p className="igStudioNote">{problems[slide.id]}</p>;
    return <Spinner size={40} />;
  }

  return createPortal((
    <div className="igStudio" role="dialog" aria-modal="true" aria-label="استوری آماده">
      <div className="igStudioTop">
        <div className="igStudioTabs" role="tablist" aria-label="طرح استوری">
          {DESIGNS.map((slide, i) => (
            <button key={slide.id} type="button" role="tab" aria-selected={i === index} className={i === index ? "is-on" : ""} onClick={() => goTo(i)}>
              {slide.label}
            </button>
          ))}
        </div>
        <button type="button" className={`igStudioWho${showWho ? " is-on" : ""}`} aria-pressed={showWho} onClick={toggleWho}>
          <span className="igStudioWhoBox" aria-hidden="true">{showWho ? <Check size={14} strokeWidth={3} /> : null}</span>
          اسم و عکس
        </button>
        <button type="button" ref={closeRef} className="igStudioClose" onClick={onClose} aria-label="بستن استوری آماده">
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="igStudioRail" ref={railRef} onScroll={onRailScroll}>
        {DESIGNS.map((slide, i) => (
          <div key={slide.id} className="igStudioSlide" aria-hidden={i !== index}>
            <div className="igStudioPicture">{slideBody(slide)}</div>
          </div>
        ))}
      </div>
      <div className="igStudioBar">
        <button type="button" className="igStudioMain" disabled={!preview} onClick={canShareFile ? share : save}>
          {canShareFile ? <InstagramGlyph size={19} /> : <Download size={19} aria-hidden="true" />}
          {canShareFile ? "بفرست به اینستاگرام" : "ذخیره عکس"}
        </button>
        {canShareFile ? (
          <button type="button" className="igStudioSave" disabled={!preview} onClick={save} aria-label="ذخیره عکس">
            <Download size={20} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <SheetBackHandler onClose={onClose} />
    </div>
  ), document.body);
}
