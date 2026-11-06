/**
 * Client-side downscale + re-encode before an avatar/poster/portfolio image
 * is turned into a data URL and POSTed to the server. Without this, a
 * phone photo (routinely 3-4MB) is sent essentially as-is -- base64-encoded
 * that's ~4-5.3MB of JSON on a single synchronous request, which is most of
 * why "save" on an avatar/poster change feels slow: the upload itself is
 * genuinely that big, not just perceived lag. Resizing to a sane max
 * dimension and re-encoding as JPEG at a reasonable quality routinely
 * brings a multi-MB photo down to a few hundred KB with no visible quality
 * loss at the sizes this UI actually displays avatars/posters/portfolio
 * tiles at.
 *
 * Falls back to the original file's data URL (uncompressed) on any
 * failure -- a slow upload is a UX problem, a broken one is worse, so
 * compression is a best-effort optimization, never a hard requirement.
 */
import { reportClientError } from "./reportClientError";

const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.82;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("FileReader failed"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image decode failed"));
    img.src = src;
  });
}

/** The words a person sees when the phone cannot hand over the photo (callers show it on ""). */
export const UNREADABLE_PHOTO = "این عکس باز نشد؛ یه عکس دیگه انتخاب کن.";

/** The biggest photo we try to shrink. A phone photo is often 4-8MB; it leaves the phone at a few hundred KB. */
export const MAX_PICKED_PHOTO_BYTES = 15 * 1024 * 1024;
export const PHOTO_TOO_BIG = "عکس باید کمتر از ۱۵ مگ باشه.";

/** Some Android galleries hand over a photo with no type at all; the picker only offers images, so that one counts. */
export const isPickedImage = (file) => Boolean(file) && (!file.type || file.type.startsWith("image/"));

/** How long to wait before the second and third try. Short enough that a person only sees the photo arrive a moment late. */
export const PHOTO_RETRY_WAITS_MS = [300, 900];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// What we need to tell why one phone fails only sometimes: how long the app had been open and how new the photo was.
function photoFacts(file, failure, tries) {
  const size = Math.round((Number(file?.size) || 0) / 1024);
  const appOpen = typeof performance === "undefined" ? "?" : Math.round(performance.now() / 1000);
  const age = file?.lastModified ? `${Math.round((Date.now() - file.lastModified) / 60000)} min` : "unknown";
  const said = failure?.cause?.name || failure?.name || "unknown";
  return `${said}, type "${file?.type || ""}", ${size} KB, tries ${tries}, app open ${appOpen}s, photo age ${age}`;
}

/**
 * Runs `attempt` (anything that reads the picked photo) and tries again when it fails: on 2026-11-06 the owner's phone
 * refused three photos with NotReadableError and handed the same three over minutes later. Rejects with the last failure
 * once the tries run out. Either way we are told, under the source "handled" on the health page, so we can see whether
 * trying again helps; the person is told in Persian by the caller.
 */
export async function retryPhotoRead(file, attempt) {
  let failure;
  for (let tries = 1; tries <= PHOTO_RETRY_WAITS_MS.length + 1; tries += 1) {
    try {
      const result = await attempt();
      if (failure) reportClientError(new Error(`photo read on retry: ${photoFacts(file, failure, tries)}`), "handled");
      return result;
    } catch (error) {
      failure = error;
      if (tries <= PHOTO_RETRY_WAITS_MS.length) await wait(PHOTO_RETRY_WAITS_MS[tries - 1]);
    }
  }
  reportClientError(new Error(`photo unreadable: ${photoFacts(file, failure, PHOTO_RETRY_WAITS_MS.length + 1)}`), "handled");
  throw failure;
}

/** Resolves to a (usually much smaller) data URL. Never rejects -- falls
 *  back to the original file's raw data URL if anything above fails, and
 *  to "" when the file itself cannot be read (an Android gallery photo that
 *  is still in the cloud, or was moved: «The requested file could not be
 *  read», client error of 2026-11-04). */
export async function compressImageToDataUrl(file, {
  maxDimension = MAX_DIMENSION,
  quality = JPEG_QUALITY
} = {}) {
  let original = "";
  try {
    original = await retryPhotoRead(file, () => readFileAsDataUrl(file));
  } catch {
    return "";
  }
  try {
    if (typeof document === "undefined" || typeof Image === "undefined") return original;
    const img = await loadImage(original);
    const { width, height } = img;
    if (!width || !height) return original;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    // Already small enough, and re-encoding a PNG/GIF with transparency as
    // JPEG would lose that -- only re-encode when actually downscaling.
    if (scale >= 1) return original;
    const targetWidth = Math.round(width * scale);
    const targetHeight = Math.round(height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    const compressed = canvas.toDataURL("image/jpeg", quality);
    // toDataURL never throws for a same-origin canvas drawn from a local
    // file -- but a pathologically small/incompressible result (or a
    // canvas that silently produced an empty image) isn't worth trusting
    // over the original.
    return compressed && compressed.length > 100 && compressed.length < original.length
      ? compressed
      : original;
  } catch {
    return original;
  }
}
