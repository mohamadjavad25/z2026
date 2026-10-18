#!/usr/bin/env node
// Brings every picture that lives in Supabase Storage back into the database (the reverse of
// /api/cron/migrate-media), for a server that should not depend on Supabase: run it once on the new
// server after the database was copied over, while the old Supabase bucket can still be read.
//
// For each avatar/poster (users) and post image/thumb (posts) whose base64 column is empty and whose
// *_url points at a public Supabase Storage object, it downloads the object, checks it is a picture
// type the app serves, writes it back as a data: URL and clears the *_url column. The media routes
// already prefer the base64 copy when Storage is not configured, so pictures keep working with
// SUPABASE_URL unset. A row whose download fails is left as it was; the script can be re-run.
//
// Usage: POSTGRES_URL=... node scripts/pull-media-from-storage.mjs [--dry-run]
import { getDb, all, run } from "../app/lib/db/connection.js";

const DRY_RUN = process.argv.includes("--dry-run");
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 8 * 1024 * 1024;

function isStorageObjectUrl(url) {
  try {
    const parsed = new URL(String(url || ""));
    return parsed.protocol === "https:" && parsed.pathname.includes("/storage/v1/object/public/");
  } catch {
    return false;
  }
}

async function download(url) {
  if (!isStorageObjectUrl(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const type = String(res.headers.get("content-type") || "").split(";")[0].trim();
    if (!ALLOWED_TYPES.has(type)) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (!buffer.length || buffer.length > MAX_BYTES) return null;
    return `data:${type};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

async function pull(db, { table, blob, url }) {
  const rows = await all(db, `SELECT id, ${url} AS url FROM ${table} WHERE ${url} IS NOT NULL AND ${url} <> '' AND COALESCE(${blob}, '') = '' ORDER BY id`);
  let done = 0;
  let failed = 0;
  for (const row of rows) {
    const dataUrl = await download(row.url);
    if (!dataUrl) {
      failed += 1;
      console.log(`  ${table}.${blob} #${row.id}: could not download ${row.url}`);
      continue;
    }
    if (!DRY_RUN) {
      await run(db, `UPDATE ${table} SET ${blob} = $1, ${url} = NULL WHERE id = $2 AND ${url} = $3`, [dataUrl, row.id, row.url]);
    }
    done += 1;
  }
  console.log(`${table}.${blob}: ${rows.length} in Storage, ${done} ${DRY_RUN ? "downloadable" : "brought back"}, ${failed} failed`);
  return failed;
}

const db = await getDb();
const columns = [
  { table: "users", blob: "avatar", url: "avatar_url" },
  { table: "users", blob: "poster", url: "poster_url" },
  { table: "posts", blob: "image", url: "image_url" },
  { table: "posts", blob: "thumb", url: "thumb_url" }
];
let failures = 0;
for (const column of columns) failures += await pull(db, column);
await db.end();
if (DRY_RUN) console.log("Dry run: nothing was written.");
process.exit(failures ? 1 : 0);
