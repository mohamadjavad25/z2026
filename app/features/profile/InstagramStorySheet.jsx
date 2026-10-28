"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { Download, Share2 } from "lucide-react";
import { Spinner } from "../../components/Spinner";
import { SheetClose } from "../../components/SheetClose";
import { getPosts } from "../../shared/api/posts";
import { getSalonServices, getSalonVisitTimes } from "../../shared/api/salons";
import { formatPersianDateKey } from "../../shared/lib/persianCalendar";
import { isTooSoonToRequest } from "../../shared/lib/bookingWindow";

const W = 1080;
const H = 1920;
const INK = "#0c0d12";
const PINK = "#ff86b8";
const VIOLET = "#8b6cff";
const WORKS_NEEDED = 3;
const SLOTS_PER_DAY = 6;
const DAY_MS = 24 * 60 * 60 * 1000;

// Salons and artists get the portrait, dark card and portfolio designs; free slots are for salons only (the booking calendar is theirs).
const DESIGNS = [
  { id: "portrait", label: "پرتره" },
  { id: "dark", label: "کارت تیره" },
  { id: "works", label: "نمونه‌کار" },
  { id: "free", label: "نوبت خالی", salonOnly: true }
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
    ctx.font = `${weight} ${px}px Vazirmatn, Tahoma, sans-serif`;
    px -= 4;
  } while (px > 40 && ctx.measureText(text).width > maxWidth);
}

/** Resolves to the picture, or null when it cannot load (a missing work just leaves its tile out). */
function loadImage(src) {
  return new Promise((resolve) => {
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

function drawWordmark(ctx) {
  ctx.textAlign = "center";
  ctx.direction = "rtl";
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 64px Vazirmatn, Tahoma, sans-serif";
  ctx.globalAlpha = 0.9;
  ctx.fillText("frfro", W / 2, 230);
  ctx.globalAlpha = 1;
  const line = ctx.createLinearGradient(W / 2 - 70, 0, W / 2 + 70, 0);
  line.addColorStop(0, PINK);
  line.addColorStop(1, VIOLET);
  ctx.fillStyle = line;
  roundRect(ctx, W / 2 - 70, 262, 140, 8, 4);
  ctx.fill();
}

/** The name, the QR card, the pink «نوبتت رو از فرفرو بگیر» button and the link: shared by every design. */
async function drawFooter(ctx, url, { qrY, qrSize, ctaY, linkY, hintY }) {
  ctx.textAlign = "center";
  ctx.direction = "rtl";
  const qr = await QRCode.toDataURL(url, { width: 560, margin: 2, errorCorrectionLevel: "M", color: { dark: INK, light: "#ffffff" } });
  const qrImg = await loadImage(qr);
  const cardX = (W - qrSize) / 2;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, cardX, qrY, qrSize, qrSize, 56);
  ctx.fill();
  if (qrImg) ctx.drawImage(qrImg, cardX + 30, qrY + 30, qrSize - 60, qrSize - 60);

  const cta = "نوبتت رو از فرفرو بگیر";
  ctx.font = "900 60px Vazirmatn, Tahoma, sans-serif";
  const ctaW = ctx.measureText(cta).width + 120;
  ctx.fillStyle = PINK;
  roundRect(ctx, (W - ctaW) / 2, ctaY, ctaW, 124, 62);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.fillText(cta, W / 2, ctaY + 83);

  const shown = url.replace(/^https?:\/\//, "");
  ctx.direction = "ltr";
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  fitFont(ctx, shown, 700, 46, W - 200);
  ctx.fillText(shown, W / 2, linkY);
  ctx.direction = "rtl";
  if (hintY) {
    ctx.font = "700 40px Vazirmatn, Tahoma, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText("کد رو اسکن کن یا روی لینک بزن", W / 2, hintY);
  }
}

function drawName(ctx, name, y) {
  ctx.textAlign = "center";
  ctx.direction = "rtl";
  ctx.fillStyle = "#ffffff";
  fitFont(ctx, name, 900, 112, W - 160);
  ctx.fillText(name, W / 2, y);
}

async function drawDark(ctx, name, url) {
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  glow(ctx, 140, 260, 760, "rgba(255,134,184,0.38)");
  glow(ctx, 980, 1680, 820, "rgba(139,108,255,0.42)");
  drawWordmark(ctx);
  drawName(ctx, name, 480);
  await drawFooter(ctx, url, { qrY: 590, qrSize: 620, ctaY: 1320, linkY: 1560, hintY: 1640 });
}

/** The client's profile photo full screen, fading into ink at the bottom. Without a photo: a pink-violet ground with the first letter. */
async function drawPortrait(ctx, name, url, avatar) {
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  const photo = avatar ? await loadImage(avatar) : null;
  if (photo) {
    drawCover(ctx, photo, 0, 0, W, H);
  } else {
    const sky = ctx.createLinearGradient(0, 0, W, H);
    sky.addColorStop(0, PINK);
    sky.addColorStop(1, VIOLET);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.direction = "rtl";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "900 640px Vazirmatn, Tahoma, sans-serif";
    ctx.fillText((name || "ف").trim().slice(0, 1), W / 2, 1000);
  }
  const fade = ctx.createLinearGradient(0, H * 0.45, 0, H);
  fade.addColorStop(0, "rgba(12,13,18,0)");
  fade.addColorStop(0.7, "rgba(12,13,18,0.92)");
  fade.addColorStop(1, INK);
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, W, H);
  drawWordmark(ctx);
  drawName(ctx, name, 1130);
  await drawFooter(ctx, url, { qrY: 1190, qrSize: 340, ctaY: 1600, linkY: 1800 });
}

/** Three of the newest works in a collage: one tall tile and two stacked on the right. Missing pictures leave their tile dark. */
async function drawWorks(ctx, name, url, works) {
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  glow(ctx, 140, 260, 760, "rgba(255,134,184,0.3)");
  glow(ctx, 980, 1680, 820, "rgba(139,108,255,0.34)");
  drawWordmark(ctx);
  drawName(ctx, name, 400);

  const pictures = await Promise.all(works.slice(0, WORKS_NEEDED).map((work) => loadImage(work.src)));
  const tiles = [
    { x: 60, y: 460, w: 540, h: 670 },
    { x: 620, y: 460, w: 400, h: 325 },
    { x: 620, y: 805, w: 400, h: 325 }
  ];
  tiles.forEach((tile, index) => {
    ctx.save();
    roundRect(ctx, tile.x, tile.y, tile.w, tile.h, 36);
    ctx.clip();
    ctx.fillStyle = "#1c1f2b";
    ctx.fillRect(tile.x, tile.y, tile.w, tile.h);
    if (pictures[index]) drawCover(ctx, pictures[index], tile.x, tile.y, tile.w, tile.h);
    ctx.restore();
  });
  await drawFooter(ctx, url, { qrY: 1180, qrSize: 340, ctaY: 1560, linkY: 1760 });
}

/** Today's and tomorrow's free start times as pink chips; a day with none says so. */
async function drawFree(ctx, name, url, days) {
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  glow(ctx, 140, 260, 760, "rgba(255,134,184,0.3)");
  glow(ctx, 980, 1680, 820, "rgba(139,108,255,0.34)");
  drawWordmark(ctx);
  drawName(ctx, name, 400);

  const chipW = 300;
  const chipH = 96;
  const gap = 24;
  const startX = (W - (3 * chipW + 2 * gap)) / 2;
  let y = 500;
  ctx.textAlign = "center";
  ctx.direction = "rtl";
  for (const day of days) {
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.font = "800 52px Vazirmatn, Tahoma, sans-serif";
    ctx.fillText(day.label, W / 2, y);
    if (!day.times.length) {
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "700 46px Vazirmatn, Tahoma, sans-serif";
      ctx.fillText(`${day.label} نوبت خالی نداری`, W / 2, y + 100);
      y += 200;
      continue;
    }
    day.times.forEach((time, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = startX + col * (chipW + gap);
      const top = y + 40 + row * (chipH + 34);
      ctx.fillStyle = PINK;
      roundRect(ctx, x, top, chipW, chipH, 48);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.font = "900 50px Vazirmatn, Tahoma, sans-serif";
      ctx.fillText(time, x + chipW / 2, top + 64);
    });
    const rows = Math.ceil(day.times.length / 3);
    y += 40 + rows * (chipH + 34) + 60;
  }
  await drawFooter(ctx, url, { qrY: 1200, qrSize: 300, ctaY: 1540, linkY: 1760 });
}

/**
 * The ready 9:16 story picture, drawn on a canvas, so it needs no server and is made fresh each time. Returns the
 * PNG as a Blob (to share) and a data URL (to show and save: the site's image policy admits data: but not blob: URLs).
 */
async function drawStory(design, { name, url, avatar, works, days }) {
  if (document.fonts?.load) {
    await Promise.all([
      document.fonts.load("900 96px Vazirmatn"),
      document.fonts.load("800 48px Vazirmatn")
    ]).catch(() => {});
  }
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const title = name || "فرفرو";
  if (design === "portrait") await drawPortrait(ctx, title, url, avatar);
  else if (design === "works") await drawWorks(ctx, title, url, works);
  else if (design === "free") await drawFree(ctx, title, url, days);
  else await drawDark(ctx, title, url);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  return { blob, dataUrl: canvas.toDataURL("image/png") };
}

/** Today and tomorrow, as Persian day keys, with the free start times a client can still request (the same check a client's booking gets). */
async function loadFreeSlots(salonId) {
  const services = await getSalonServices();
  if (!services.ok) throw new Error("services");
  const list = services.data?.services || [];
  const shortest = [...list].sort((a, b) => (Number(a.duration) || Infinity) - (Number(b.duration) || Infinity))[0];
  const now = new Date();
  const days = [
    { label: "امروز", key: formatPersianDateKey(now) },
    { label: "فردا", key: formatPersianDateKey(new Date(now.getTime() + DAY_MS)) }
  ];
  if (!shortest) return days.map((day) => ({ ...day, times: [] }));
  return Promise.all(days.map(async (day) => {
    const { ok, data } = await getSalonVisitTimes(salonId, day.key, [shortest.name]);
    if (!ok) throw new Error("times");
    const times = (data?.times || []).filter((time) => !isTooSoonToRequest(day.key, time)).slice(0, SLOTS_PER_DAY);
    return { ...day, times };
  }));
}

/** Public posts that have a picture, newest first, for the collage. */
async function loadWorks() {
  const res = await getPosts();
  if (!res.ok) return [];
  return (res.data?.posts || [])
    .filter((post) => post.image_url && post.is_public !== false)
    .map((post) => ({ src: post.image_url }));
}

/**
 * «استوری آماده»: shows the picture and hands it over. Where the phone can share a file (Chrome on Android,
 * Safari on iPhone) «بفرست به اینستاگرام» opens the share list with Instagram in it; elsewhere «ذخیره عکس» saves it.
 */
export function InstagramStorySheet({ open, name, url, avatar = "", profileType = "", profileId = null, onClose, onNotify }) {
  const isSalon = profileType === "salon";
  const [design, setDesign] = useState("portrait");
  const [works, setWorks] = useState(null);
  const [slots, setSlots] = useState(null);
  const [slotsFailed, setSlotsFailed] = useState(false);
  const [blob, setBlob] = useState(null);
  const [preview, setPreview] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setWorks(null);
    setSlots(null);
    setSlotsFailed(false);
    loadWorks()
      .then((list) => { if (!cancelled) setWorks(list); })
      .catch(() => { if (!cancelled) setWorks([]); });
    if (isSalon && profileId) {
      loadFreeSlots(profileId)
        .then((days) => { if (!cancelled) setSlots(days); })
        .catch(() => { if (!cancelled) { setSlotsFailed(true); setSlots([]); } });
    }
    return () => { cancelled = true; };
  }, [open, isSalon, profileId]);

  const worksReady = works !== null && works.length >= WORKS_NEEDED;
  const dataReady = works !== null && (!isSalon || slots !== null);

  useEffect(() => {
    if (!open || !dataReady) return undefined;
    let cancelled = false;
    setFailed(false);
    setPreview("");
    setBlob(null);
    if (design === "free" && slotsFailed) {
      setFailed(true);
      return undefined;
    }
    drawStory(design, { name: name || "فرفرو", url, avatar, works: works || [], days: slots || [] })
      .then((made) => {
        if (cancelled) return;
        if (!made.blob) { setFailed(true); return; }
        setBlob(made.blob);
        setPreview(made.dataUrl);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [open, design, name, url, avatar, works, slots, slotsFailed, dataReady]);

  if (!open || typeof document === "undefined") return null;

  const file = blob ? new File([blob], "frfro-story.png", { type: "image/png" }) : null;
  const canShareFile = Boolean(file && typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] }));

  async function share() {
    try {
      await navigator.share({ files: [file] });
    } catch (error) {
      if (error?.name !== "AbortError") save();
    }
  }

  function save() {
    if (!preview) return;
    const a = document.createElement("a");
    a.href = preview;
    a.download = "frfro-story.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    onNotify?.("عکس ذخیره شد. حالا بذارش تو استوری.");
  }

  const hint = design === "works" && works !== null && !worksReady
    ? `حداقل ${WORKS_NEEDED} عکس تو نمونه‌کار بذار`
    : design === "portrait" && !avatar
      ? "عکس بذار تا قشنگ‌تر بشه"
      : "";

  return createPortal((
    <div className="salonQrSheetOverlay" role="dialog" aria-modal="true" aria-label="استوری آماده" onClick={onClose}>
      <article className="salonQrSheetCard igStoryCard" onClick={(event) => event.stopPropagation()}>
        <h3 className="igStoryTitle">استوری آماده</h3>
        <div className="igStoryTabs" role="tablist" aria-label="طرح استوری">
          {DESIGNS.filter((item) => !item.salonOnly || isSalon).map((item) => {
            const disabled = item.id === "works" && works !== null && !worksReady;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={design === item.id}
                className={design === item.id ? "is-on" : ""}
                disabled={disabled}
                onClick={() => setDesign(item.id)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="igStoryFrame">
          {preview ? <img src={preview} alt={`استوری ${name}`} /> : failed ? <p className="igStoryFail">عکس ساخته نشد؛ دوباره بزن.</p> : <Spinner size={40} />}
        </div>
        {hint ? <p className="igStoryNote">{hint}</p> : null}
        <p className="igStoryHint">توی استوری بذارش و برچسب لینک اینستاگرام رو با لینک صفحه‌ت روش بچسبون.</p>
        <div className="igStoryButtons">
          {canShareFile ? (
            <button type="button" className="igStoryShare" disabled={!file} onClick={share}>
              <Share2 size={17} aria-hidden="true" />
              بفرست به اینستاگرام
            </button>
          ) : null}
          <button type="button" className={canShareFile ? "igStorySave is-quiet" : "igStorySave"} disabled={!preview} onClick={save}>
            <Download size={17} aria-hidden="true" />
            ذخیره عکس
          </button>
        </div>
        <SheetClose onClick={onClose} />
      </article>
    </div>
  ), document.body);
}
