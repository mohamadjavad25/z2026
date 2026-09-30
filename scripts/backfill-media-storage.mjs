#!/usr/bin/env node
// One-time backfill: uploads every existing base64 avatar/poster/post
// image to Supabase Storage and fills in the matching *_url column added
// by migrations/008_media_storage_urls.sql, for rows created before
// app/lib/storage.js's dual-write existed (or that dual-write attempted
// and failed at the time, e.g. Storage wasn't configured yet).
//
// Safe to re-run: only touches rows where the *_url column is still
// NULL, so it never re-uploads or overwrites an already-backfilled row.
// Requires SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY to be set (see
// .env.example) -- exits with a clear error otherwise, same as any other
// script here that needs a real Postgres connection string.
//
// Usage: node scripts/backfill-media-storage.mjs [--dry-run]
import { getDb, all, run } from "../app/lib/db/connection.js";
import { isStorageConfigured, uploadImageDataUrl } from "../app/lib/storage.js";

const DRY_RUN = process.argv.includes("--dry-run");

async function backfillUsers(db) {
  const rows = await all(db, `
    SELECT id, avatar, poster, avatar_url, poster_url FROM users
    WHERE (avatar != '' AND avatar_url IS NULL) OR (poster != '' AND poster_url IS NULL)
  `, []);
  console.log(`users: ${rows.length} row(s) need backfill`);
  let done = 0;
  for (const row of rows) {
    const needsAvatar = Boolean(row.avatar && !row.avatar_url);
    const needsPoster = Boolean(row.poster && !row.poster_url);
    if (DRY_RUN) {
      console.log(`  [dry-run] user ${row.id}: avatar=${needsAvatar} poster=${needsPoster}`);
      continue;
    }
    const [avatarUrl, posterUrl] = await Promise.all([
      needsAvatar ? uploadImageDataUrl(row.avatar, { kind: "avatar", ownerId: row.id }) : null,
      needsPoster ? uploadImageDataUrl(row.poster, { kind: "poster", ownerId: row.id }) : null
    ]);
    if (avatarUrl || posterUrl) {
      await run(db, `
        UPDATE users SET avatar_url = COALESCE(?, avatar_url), poster_url = COALESCE(?, poster_url) WHERE id = ?
      `, [avatarUrl, posterUrl, row.id]);
      done += 1;
    } else if (needsAvatar || needsPoster) {
      console.warn(`  user ${row.id}: upload failed (check logs above) -- left for a future re-run`);
    }
  }
  console.log(`users: ${done} row(s) backfilled`);
}

async function backfillPosts(db) {
  const rows = await all(db, "SELECT id, image FROM posts WHERE image != '' AND image_url IS NULL", []);
  console.log(`posts: ${rows.length} row(s) need backfill`);
  let done = 0;
  for (const row of rows) {
    if (DRY_RUN) {
      console.log(`  [dry-run] post ${row.id}`);
      continue;
    }
    const imageUrl = await uploadImageDataUrl(row.image, { kind: "post", ownerId: row.id });
    if (imageUrl) {
      await run(db, "UPDATE posts SET image_url = ? WHERE id = ?", [imageUrl, row.id]);
      done += 1;
    } else {
      console.warn(`  post ${row.id}: upload failed (check logs above) -- left for a future re-run`);
    }
  }
  console.log(`posts: ${done} row(s) backfilled`);
}

async function main() {
  if (!DRY_RUN && !isStorageConfigured()) {
    console.error("Supabase Storage not configured -- set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example), or pass --dry-run to just see counts.");
    process.exit(1);
  }
  const db = await getDb();
  await backfillUsers(db);
  await backfillPosts(db);
  console.log(DRY_RUN ? "Dry run complete -- no writes made." : "Backfill complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
