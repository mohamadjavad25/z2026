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

/** Resolves to a (usually much smaller) data URL. Never rejects -- falls
 *  back to the original file's raw data URL if anything above fails. */
export async function compressImageToDataUrl(file, {
  maxDimension = MAX_DIMENSION,
  quality = JPEG_QUALITY
} = {}) {
  const original = await readFileAsDataUrl(file);
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
