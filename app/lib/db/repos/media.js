// Whitelisted image types trusted to set the HTTP Content-Type header when
// streaming a stored `data:...;base64,...` blob back out (post images,
// avatars) — an unrecognized type must never reach storage, since a stored
// `data:text/html;...` served back with that header would be a stored-XSS
// vector the moment a browser requests the media URL directly.
export const ALLOWED_POSTER_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** Parses a `data:<type>;base64,<data>` string; returns null if malformed or the type isn't in `allowedTypes`. */
export function parseMediaDataUrl(dataUrl, allowedTypes) {
  const match = /^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
  if (!match) return null;
  const [, contentType, base64] = match;
  if (!allowedTypes.includes(contentType)) return null;
  return { contentType, base64 };
}
