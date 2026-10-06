import { createHash } from "node:crypto";
import { getDb, get } from "./db/connection.js";
import { parseMediaDataUrl, ALLOWED_POSTER_TYPES } from "./db/repos/media.js";
import { fetchStoredImage } from "./storage.js";

/**
 * Serving a stored picture. The picture lives in Supabase Storage (url column) or, for rows not
 * moved yet or when Storage is off, as base64 in the row. Either way the bytes leave the
 * database/Storage only when a browser really needs them: a cheap fingerprint answers "has it
 * changed?" (304) first, and Storage objects are proxied through this route so Vercel's CDN
 * caches them instead of every viewer going to Supabase.
 */

const NOSNIFF = { "X-Content-Type-Options": "nosniff" };

/** Bytes + type for one picture: Storage first, base64 column as the fallback. Null if neither works. */
export async function loadPicture({ url, readBlob }) {
  if (url) {
    const stored = await fetchStoredImage(url);
    if (stored && ALLOWED_POSTER_TYPES.includes(stored.contentType.split(";")[0])) return stored;
  }
  const parsed = parseMediaDataUrl(await readBlob(), ALLOWED_POSTER_TYPES);
  return parsed ? { buffer: Buffer.from(parsed.base64, "base64"), contentType: parsed.contentType } : null;
}

export function pictureResponse(picture, cacheControl, extra = {}) {
  return new Response(picture.buffer, {
    status: 200,
    headers: {
      ...NOSNIFF,
      ...extra,
      "Content-Type": picture.contentType.split(";")[0],
      "Content-Length": String(picture.buffer.length),
      "Cache-Control": cacheControl
    }
  });
}

// "avatar" / "poster" -> the users columns behind them (never built from request input).
const USER_PICTURES = {
  avatar: { blob: "avatar", url: "avatar_url" },
  poster: { blob: "poster", url: "poster_url" }
};

/**
 * GET handler body for /api/media/avatar|poster/:userId. Re-uploads must show up at once, so the
 * browser always revalidates (max-age=0) -- but against a fingerprint, not the picture: a 304
 * costs the database a few bytes. Vercel's CDN may keep a copy for 30s on top of that.
 */
export async function serveUserPicture(request, userId, which) {
  const col = USER_PICTURES[which];
  const db = await getDb();
  const meta = await get(db, `
    SELECT updated_at::text AS stamp, length(${col.blob}) AS size, ${col.url} AS url
    FROM users WHERE id = $1 AND (${col.blob} <> '' OR ${col.url} IS NOT NULL)
  `, [userId]);
  if (!meta) return new Response(null, { status: 404 });

  const etag = `"${createHash("sha1").update(`${userId}|${meta.stamp}|${meta.size}|${meta.url || ""}`).digest("hex")}"`;
  const cacheControl = "public, max-age=0, s-maxage=30, must-revalidate";
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ...NOSNIFF, "Cache-Control": cacheControl, ETag: etag } });
  }

  const picture = await loadPicture({
    url: meta.url,
    readBlob: async () => (await get(db, `SELECT ${col.blob} AS data FROM users WHERE id = $1`, [userId]))?.data
  });
  if (!picture) return new Response(null, { status: 404 });
  return pictureResponse(picture, cacheControl, { ETag: etag });
}
