import { NextResponse } from "next/server";
import { ensureDb } from "../../../lib/db/connection.js";
import * as stories from "../../../lib/db/repos/stories.js";
import { requireUser } from "../../../lib/http.js";

export const runtime = "nodejs";

// The salons list no longer carries the video (detail endpoint does), so a
// generous cap is safe here. Still keep it bounded: data URLs live in JSON.
const MAX_VIDEO_LEN = 40_000_000;
const MAX_POSTER_LEN = 3_000_000;

// Only these profile types ever have a public page that spreads storyFieldsFor —
// a client account saving a "story" would just be dead storage with no viewer.
const STORY_ROLES = ["salon", "shop", "artist"];

export async function GET(request) {
  ensureDb();
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ story: stories.getStory(auth.user.id) });
}

export async function POST(request) {
  ensureDb();
  try {
    const auth = requireUser(request);
    if (!auth.ok) return auth.response;
    if (!STORY_ROLES.includes(auth.user.type)) {
      return NextResponse.json({ error: "این نوع حساب استوری ندارد." }, { status: 403 });
    }
    const body = await request.json();
    const video = typeof body?.video === "string" ? body.video : "";
    const poster = typeof body?.poster === "string" ? body.poster : "";
    if (!video && !poster) {
      return NextResponse.json({ error: "ویدیو یا پوستر استوری خالی است." }, { status: 400 });
    }
    if (video.length > MAX_VIDEO_LEN || poster.length > MAX_POSTER_LEN) {
      return NextResponse.json({ error: "حجم ویدیو یا پوستر استوری بیش از حد مجاز است (ویدیو حداکثر ۳۰ مگابایت)." }, { status: 413 });
    }
    // Only a whitelisted video/image MIME type may be stored — this is what
    // the media route later serves back as a real Content-Type header, so an
    // unchecked type here would become a stored-content vector at read time.
    if (video && !stories.parseStoryDataUrl(video, stories.ALLOWED_VIDEO_TYPES)) {
      return NextResponse.json({ error: "فرمت ویدیو مجاز نیست (mp4، webm، quicktime یا ogg)." }, { status: 400 });
    }
    if (poster && !stories.parseStoryDataUrl(poster, stories.ALLOWED_POSTER_TYPES)) {
      return NextResponse.json({ error: "فرمت عکس پوستر مجاز نیست (jpeg، png، webp یا gif)." }, { status: 400 });
    }
    stories.saveStory(auth.user.id, { video, poster });
    return NextResponse.json({ ok: true, story: stories.getStory(auth.user.id) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "ذخیره استوری انجام نشد." }, { status: 500 });
  }
}

export async function DELETE(request) {
  ensureDb();
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  stories.deleteStory(auth.user.id);
  return NextResponse.json({ ok: true });
}
