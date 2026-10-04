/**
 * A small copy of a picture for grid cards, made in the browser right before a post is saved, so the
 * server never has to resize anything (no image library in the server bundle). Returns "" on failure.
 */
export async function makeThumbDataUrl(dataUrl, width = 640) {
  if (typeof document === "undefined" || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) return "";
  try {
    const image = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = dataUrl;
    });
    const scale = Math.min(1, width / (image.naturalWidth || width));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round((image.naturalWidth || width) * scale));
    canvas.height = Math.max(1, Math.round((image.naturalHeight || width) * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    const webp = canvas.toDataURL("image/webp", 0.78);
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.8);
  } catch {
    return "";
  }
}
