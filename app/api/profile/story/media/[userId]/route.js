import { ensureDb } from "../../../../../lib/db/connection.js";
import { getUserFromRequest } from "../../../../../lib/auth.js";
import * as stories from "../../../../../lib/db/repos/stories.js";
import * as users from "../../../../../lib/db/repos/users.js";
import * as userSettings from "../../../../../lib/db/repos/userSettings.js";

export const runtime = "nodejs";

/**
 * Streams a profile's story video/poster instead of embedding it in JSON —
 * getSalon/getArtistProfile only ship this URL now (see storyFieldsFor in
 * app/lib/db/repos/stories.js). Supports HTTP Range so the
 * <video> tag can seek/lazy-load instead of pulling the whole file up front,
 * and is cached hard since the URL itself is versioned (?v=updated_at).
 */
export async function GET(request, { params }) {
  ensureDb();
  const { userId: userIdParam } = await params;
  const userId = Number(userIdParam);
  if (!userId) return new Response(null, { status: 404 });

  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind") === "poster" ? "poster" : "video";

  // A salon/artist switched to "خصوصی" hides its story the same way it hides
  // everything else in تنظیمات — except from its own owner (see the
  // publicPortfolio toggle in ProfileSettingsPanel.jsx).
  const owner = users.getUserById(userId);
  const privacyAware = owner?.type === "salon" || owner?.type === "artist";
  if (privacyAware && userSettings.getSettings(userId).publicPortfolio === false) {
    const viewer = getUserFromRequest(request);
    if (viewer?.id !== userId) return new Response(null, { status: 404 });
  }

  const story = stories.getStory(userId);
  const raw = kind === "poster" ? story.poster : story.video;
  const allowedTypes = kind === "poster" ? stories.ALLOWED_POSTER_TYPES : stories.ALLOWED_VIDEO_TYPES;
  const parsed = stories.parseStoryDataUrl(raw, allowedTypes);
  if (!parsed) return new Response(null, { status: 404 });

  const buffer = Buffer.from(parsed.base64, "base64");
  const total = buffer.length;
  const headers = {
    "Content-Type": parsed.contentType,
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable"
  };

  const range = request.headers.get("range");
  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    const start = match?.[1] ? Number(match[1]) : 0;
    const end = match?.[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= total) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
    }
    const chunk = buffer.subarray(start, end + 1);
    return new Response(chunk, {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Content-Length": String(chunk.length)
      }
    });
  }

  return new Response(buffer, {
    status: 200,
    headers: { ...headers, "Content-Length": String(total) }
  });
}
