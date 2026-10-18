/**
 * Pictures and voice notes in support conversations. They arrive as `data:<type>;base64,<data>` strings in the
 * message JSON (same as every other upload in the app) and are kept as bytes in the database, never in the public
 * Storage bucket: a support screenshot can show someone's bookings or phone number, so it is only ever served to the
 * ticket's owner and to admins (app/api/support/attachments/[id]).
 *
 * The declared type is not trusted: the first bytes decide what the file really is, and that is the type it is served with.
 */

export const MAX_IMAGES_PER_MESSAGE = 4;
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_VOICE_BYTES = 3 * 1024 * 1024;
export const MAX_VOICE_MS = 3 * 60 * 1000;
// Vercel refuses request bodies over 4.5MB; base64 adds a third, so this keeps a whole message under it.
export const MAX_MESSAGE_BYTES = 3.2 * 1024 * 1024;

const DATA_URL_RE = /^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+)(?:;[a-zA-Z0-9=.+-]+)*;base64,([A-Za-z0-9+/=]+)$/;

const startsWith = (buffer, bytes, offset = 0) => bytes.every((byte, index) => buffer[offset + index] === byte);
const ascii = (text) => [...text].map((char) => char.charCodeAt(0));

/** The real type of an image from its first bytes, or "" when it is not one we accept. */
export function sniffImage(buffer) {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(buffer, ascii("RIFF")) && startsWith(buffer, ascii("WEBP"), 8)) return "image/webp";
  if (startsWith(buffer, ascii("GIF8"))) return "image/gif";
  return "";
}

/** The real type of a recording from its first bytes (what MediaRecorder makes on Chrome/Android, Firefox and Safari). */
export function sniffAudio(buffer) {
  if (startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3])) return "audio/webm";
  if (startsWith(buffer, ascii("OggS"))) return "audio/ogg";
  if (startsWith(buffer, ascii("ftyp"), 4)) return "audio/mp4";
  if (startsWith(buffer, ascii("ID3")) || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) return "audio/mpeg";
  if (startsWith(buffer, ascii("RIFF")) && startsWith(buffer, ascii("WAVE"), 8)) return "audio/wav";
  return "";
}

const fail = (message) => ({ ok: false, error: message });

/**
 * Checks what came with a message: up to four pictures, or one voice note (plus, either way, optional text).
 * Returns { ok: true, items: [{ kind, contentType, buffer, durationMs }] } or { ok: false, error } with a message for the person.
 */
export function parseAttachments(input) {
  if (input === undefined || input === null) return { ok: true, items: [] };
  if (!Array.isArray(input)) return fail("پیوست نامعتبر است.");
  if (!input.length) return { ok: true, items: [] };
  const items = [];
  let total = 0;
  for (const raw of input) {
    const kind = raw?.kind === "voice" ? "voice" : raw?.kind === "image" ? "image" : "";
    const match = DATA_URL_RE.exec(String(raw?.data || ""));
    if (!kind || !match) return fail("پیوست نامعتبر است.");
    const buffer = Buffer.from(match[2], "base64");
    total += buffer.length;
    if (kind === "image") {
      const contentType = sniffImage(buffer);
      if (!contentType) return fail("فقط عکس (JPG، PNG، WebP یا GIF) می‌شود فرستاد.");
      if (buffer.length > MAX_IMAGE_BYTES) return fail("عکس خیلی بزرگ است (حداکثر ۳ مگابایت).");
      items.push({ kind, contentType, buffer, durationMs: null });
    } else {
      const contentType = sniffAudio(buffer);
      if (!contentType) return fail("این فایل صوتی پشتیبانی نمی‌شود.");
      if (buffer.length > MAX_VOICE_BYTES) return fail("پیام صوتی خیلی بزرگ است.");
      const durationMs = Math.round(Number(raw.durationMs) || 0);
      if (durationMs > MAX_VOICE_MS + 2000) return fail("پیام صوتی حداکثر ۳ دقیقه می‌تواند باشد.");
      if (buffer.length < 200) return fail("پیام صوتی خالی است.");
      items.push({ kind, contentType, buffer, durationMs: durationMs > 0 ? durationMs : null });
    }
  }
  const voices = items.filter((item) => item.kind === "voice").length;
  if (voices > 1 || (voices && items.length > 1)) return fail("پیام صوتی را جدا بفرست.");
  if (items.length > MAX_IMAGES_PER_MESSAGE) return fail("در هر پیام حداکثر ۴ عکس می‌شود فرستاد.");
  if (total > MAX_MESSAGE_BYTES) return fail("حجم پیوست‌ها زیاد است. عکس‌ها را جدا بفرست.");
  return { ok: true, items };
}

/** The line shown in lists and pushes for a message that is only a picture or a voice note. */
export function attachmentSummary(items) {
  if (!items?.length) return "";
  if (items[0].kind === "voice") return "🎤 پیام صوتی";
  return items.length > 1 ? `🖼 ${items.length} عکس` : "🖼 عکس";
}

/**
 * Answers a GET for an attachment's bytes, honouring Range (Safari will not play audio without it).
 * The bytes never change for an id, so the browser may keep them; "private" keeps shared caches out.
 */
export function attachmentResponse(request, row) {
  const buffer = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data);
  const headers = {
    "Content-Type": row.content_type,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Content-Disposition": "inline",
    "Cache-Control": "private, max-age=604800, immutable",
    "Accept-Ranges": "bytes"
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") || "");
  if (range && (range[1] || range[2])) {
    const size = buffer.length;
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
    const part = buffer.subarray(start, end + 1);
    return new Response(part, { status: 206, headers: { ...headers, "Content-Length": String(part.length), "Content-Range": `bytes ${start}-${end}/${size}` } });
  }
  return new Response(buffer, { status: 200, headers: { ...headers, "Content-Length": String(buffer.length) } });
}
