/**
 * Server-side upload size enforcement for images stored as inline
 * `data:<type>;base64,<data>` strings (avatar/poster/post/portfolio
 * images -- see app/lib/db/repos/media.js for the matching read-side
 * type-allowlist check). Confirmed gap: until this file, only client-side
 * JS checked upload size before FileReader.readAsDataURL
 * (app/features/shell/useProfileEditor.js, app/features/artist/useArtistWorkspace.js)
 * -- trivially bypassed by a direct API call, letting an arbitrarily large
 * base64 blob land in a Postgres row with no server-enforced ceiling.
 *
 * This does not change WHERE images are stored (still inline base64 in
 * Postgres TEXT columns) -- moving that to real object storage
 * (Supabase Storage) needs live credentials this environment doesn't have
 * to implement and verify safely; see docs/DEVLOG.md for that decision.
 * This is the one part of that plan fully verifiable without external
 * credentials, so it ships on its own.
 */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

const DATA_URL_RE = /^data:[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+;base64,([A-Za-z0-9+/=]+)$/;

/** Decoded byte size of a `data:...;base64,...` string's payload, or null
 *  if `value` isn't a data: URL at all -- e.g. empty, or already an
 *  `/api/media/...` URL a client resubmitted unchanged (that case is
 *  correctly *not* re-validated here, only a genuinely new base64 upload
 *  is). */
export function dataUrlByteSize(value) {
  const match = DATA_URL_RE.exec(String(value || ""));
  if (!match) return null;
  const base64 = match[1];
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/** True only when `value` is a data: URL AND exceeds `maxBytes` -- never
 *  true for a non-data-URL value (empty string, an existing media URL). */
export function isImageDataUrlTooLarge(value, maxBytes = MAX_IMAGE_BYTES) {
  const size = dataUrlByteSize(value);
  return size != null && size > maxBytes;
}
