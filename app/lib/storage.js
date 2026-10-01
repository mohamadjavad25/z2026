import { createClient } from "@supabase/supabase-js";
import { parseMediaDataUrl, ALLOWED_POSTER_TYPES } from "./db/repos/media.js";

/**
 * Supabase Storage dual-write path -- see migrations/008_media_storage_urls.sql
 * and docs/DEVLOG.md. This is add-only: the base64 columns
 * (users.avatar/poster, posts.image) and the /api/media/* streaming
 * routes remain the source of truth. This module's job is only to also
 * put a copy in Storage and hand back a public URL to store in the new
 * `*_url` columns, best-effort.
 *
 * Deliberately NEVER throws out to a caller -- every export here either
 * returns a URL string or null. An avatar/poster/post save must not fail
 * just because Storage isn't configured (true for every environment this
 * was developed in -- see docs/DEVLOG.md on why this sandbox has neither
 * credentials nor network access to supabase.com) or because Storage
 * itself hiccups; the base64 write already happened/will happen
 * regardless, and that's what every read path still uses.
 */

const EXT_BY_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

let cachedClient;
/** Returns a configured Supabase client, or null if SUPABASE_URL /
 *  SUPABASE_SERVICE_ROLE_KEY aren't set. Cached after the first call --
 *  same reasoning as connection.js's getPool(). */
function getStorageClient() {
  if (cachedClient !== undefined) return cachedClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  cachedClient = url && key ? createClient(url, key) : null;
  return cachedClient;
}

export function isStorageConfigured() {
  return Boolean(getStorageClient());
}

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "media";

/** Builds a storage object key: "<kind>/<ownerId>/<unique>.<ext>". Pure
 *  and independent of any network/credential state, so it's testable on
 *  its own (see tests/unit/storage.test.js). */
export function buildStorageKey(kind, ownerId, contentType) {
  const safeKind = String(kind || "misc").replace(/[^a-z0-9_-]/gi, "");
  const safeOwnerId = String(ownerId || "0").replace(/[^0-9]/g, "") || "0";
  const ext = EXT_BY_TYPE[contentType] || "bin";
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return `${safeKind}/${safeOwnerId}/${unique}.${ext}`;
}

/**
 * Uploads a `data:<type>;base64,<data>` string to Supabase Storage and
 * returns its public URL, or null if: the data URL is malformed/not an
 * allowed image type, Storage isn't configured, or the upload itself
 * fails for any reason (network, auth, bucket missing, ...). Every
 * failure is logged, never thrown -- see the module doc comment above.
 */
export async function uploadImageDataUrl(dataUrl, { kind, ownerId, allowedTypes = ALLOWED_POSTER_TYPES } = {}) {
  const parsed = parseMediaDataUrl(dataUrl, allowedTypes);
  if (!parsed) return null;
  const client = getStorageClient();
  if (!client) return null;
  try {
    const key = buildStorageKey(kind, ownerId, parsed.contentType);
    const buffer = Buffer.from(parsed.base64, "base64");
    const { error: uploadError } = await client.storage.from(BUCKET).upload(key, buffer, {
      contentType: parsed.contentType,
      upsert: false
    });
    if (uploadError) {
      console.error(`Supabase Storage upload failed (${kind}/${ownerId}):`, uploadError.message);
      return null;
    }
    const { data } = client.storage.from(BUCKET).getPublicUrl(key);
    return data?.publicUrl || null;
  } catch (error) {
    console.error(`Supabase Storage upload threw (${kind}/${ownerId}):`, error.message);
    return null;
  }
}
