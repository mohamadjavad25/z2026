// Helpers for post pictures served by /api/media/post/:id.

/** A smaller copy of a post picture for grid cards (the full size stays for the viewer). */
export function thumbUrl(url, width = 480) {
  const text = typeof url === "string" ? url : "";
  if (!text.startsWith("/api/media/post/")) return text;
  return `${text}${text.includes("?") ? "&" : "?"}w=${width}`;
}

const warmed = new Set();

/** Starts downloading pictures ahead of time so a tab opens with them already in the browser cache. */
export function preloadImages(urls = []) {
  if (typeof window === "undefined") return;
  urls.forEach((url) => {
    if (!url || warmed.has(url)) return;
    warmed.add(url);
    const image = new Image();
    image.decoding = "async";
    image.src = url;
  });
}
