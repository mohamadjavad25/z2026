export function loadShopProductBitmap(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image-load-failed"));
    image.src = src;
  });
}

export async function renderShopProductCanvas(src, { filter = "none", aspect = null, maxSize = 1400 } = {}) {
  const image = await loadShopProductBitmap(src);
  let sx = 0;
  let sy = 0;
  let sw = image.naturalWidth || image.width;
  let sh = image.naturalHeight || image.height;

  if (aspect && aspect > 0) {
    if (sw / sh > aspect) {
      const next = sh * aspect;
      sx = (sw - next) / 2;
      sw = next;
    } else {
      const next = sw / aspect;
      sy = (sh - next) / 2;
      sh = next;
    }
  }

  let dw = sw;
  let dh = sh;
  if (dw > maxSize) {
    const scale = maxSize / dw;
    dw = Math.round(maxSize);
    dh = Math.round(sh * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(dw));
  canvas.height = Math.max(1, Math.round(dh));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.filter = filter;
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  ctx.filter = "none";
  return canvas.toDataURL("image/jpeg", 0.92);
}
