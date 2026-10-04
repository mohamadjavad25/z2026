import sharp from "sharp";
import { parseMediaDataUrl, ALLOWED_POSTER_TYPES } from "./db/repos/media.js";

export const THUMB_WIDTH = 480;

/** Resizes a stored data-URL picture to a WebP of `width`; returns the raw bytes (or null if it can't be read). */
export async function resizeDataUrl(dataUrl, width) {
  const parsed = parseMediaDataUrl(dataUrl, ALLOWED_POSTER_TYPES);
  if (!parsed) return null;
  try {
    return await sharp(Buffer.from(parsed.base64, "base64"))
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 74 })
      .toBuffer();
  } catch {
    return null;
  }
}

/** The 480px thumbnail as a base64 string for the posts.thumb column ("" when it can't be made). */
export async function makeThumbBase64(dataUrl) {
  const bytes = await resizeDataUrl(dataUrl, THUMB_WIDTH);
  return bytes ? bytes.toString("base64") : "";
}
