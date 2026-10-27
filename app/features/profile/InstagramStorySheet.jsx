"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { Download, Share2 } from "lucide-react";
import { Spinner } from "../../components/Spinner";
import { SheetClose } from "../../components/SheetClose";

const W = 1080;
const H = 1920;
const INK = "#0c0d12";
const PINK = "#ff86b8";
const VIOLET = "#8b6cff";

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

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * The ready 9:16 story picture: ink ground with the brand's pink and violet light, the name, a QR of the public
 * page, «نوبتت رو از فرفرو بگیر» and the link (for Instagram's link sticker). Drawn on a canvas, so it needs no
 * server and is made fresh each time. Returns the PNG as a Blob (to share) and a data URL (to show and save: the
 * site's image policy admits data: but not blob: URLs).
 */
async function drawStory(name, url) {
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

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  const glow = (x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(12,13,18,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  glow(140, 260, 760, "rgba(255,134,184,0.38)");
  glow(980, 1680, 820, "rgba(139,108,255,0.42)");

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

  ctx.fillStyle = "#ffffff";
  fitFont(ctx, name, 900, 112, W - 160);
  ctx.fillText(name, W / 2, 480);

  const qr = await QRCode.toDataURL(url, { width: 560, margin: 2, errorCorrectionLevel: "M", color: { dark: INK, light: "#ffffff" } });
  const qrImg = await loadImage(qr);
  const card = 620;
  const cardX = (W - card) / 2;
  const cardY = 590;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, cardX, cardY, card, card, 56);
  ctx.fill();
  ctx.drawImage(qrImg, cardX + 30, cardY + 30, card - 60, card - 60);

  const cta = "نوبتت رو از فرفرو بگیر";
  ctx.font = "900 60px Vazirmatn, Tahoma, sans-serif";
  const ctaW = ctx.measureText(cta).width + 120;
  ctx.fillStyle = PINK;
  roundRect(ctx, (W - ctaW) / 2, 1320, ctaW, 124, 62);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.fillText(cta, W / 2, 1403);

  ctx.direction = "ltr";
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  fitFont(ctx, url.replace(/^https?:\/\//, ""), 700, 46, W - 200);
  ctx.fillText(url.replace(/^https?:\/\//, ""), W / 2, 1560);
  ctx.direction = "rtl";
  ctx.font = "700 40px Vazirmatn, Tahoma, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText("کد رو اسکن کن یا روی لینک بزن", W / 2, 1640);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  return { blob, dataUrl: canvas.toDataURL("image/png") };
}

/**
 * «استوری آماده»: shows the picture and hands it over. Where the phone can share a file (Chrome on Android,
 * Safari on iPhone) «بفرست به اینستاگرام» opens the share list with Instagram in it; elsewhere «ذخیره عکس» saves it.
 */
export function InstagramStorySheet({ open, name, url, onClose, onNotify }) {
  const [blob, setBlob] = useState(null);
  const [preview, setPreview] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setFailed(false);
    drawStory(name || "فرفرو", url)
      .then((made) => {
        if (cancelled) return;
        if (!made.blob) { setFailed(true); return; }
        setBlob(made.blob);
        setPreview(made.dataUrl);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      setBlob(null);
      setPreview("");
    };
  }, [open, name, url]);

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

  return createPortal((
    <div className="salonQrSheetOverlay" role="dialog" aria-modal="true" aria-label="استوری آماده" onClick={onClose}>
      <article className="salonQrSheetCard igStoryCard" onClick={(event) => event.stopPropagation()}>
        <h3 className="igStoryTitle">استوری آماده</h3>
        <div className="igStoryFrame">
          {preview ? <img src={preview} alt={`استوری ${name}`} /> : failed ? <p className="igStoryFail">عکس ساخته نشد؛ دوباره بزن.</p> : <Spinner size={40} />}
        </div>
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
