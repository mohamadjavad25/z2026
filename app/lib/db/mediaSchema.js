import { getDb, get, run } from "./connection.js";

let ready;

/**
 * posts.thumb_url (migration 023) holds the Storage copy of a post's small grid picture.
 * Applied here too, once per process, because deploys do not always run the migration step
 * first -- the same self-healing approach the admin tables use. Idempotent.
 */
export function ensureMediaColumns() {
  if (!ready) {
    ready = (async () => {
      const db = await getDb();
      const exists = await get(db, `
        SELECT 1 AS ok FROM information_schema.columns
        WHERE table_name = 'posts' AND column_name = 'thumb_url' AND table_schema = current_schema()
      `);
      if (!exists) await run(db, "ALTER TABLE posts ADD COLUMN IF NOT EXISTS thumb_url TEXT");
    })().catch((error) => {
      ready = undefined;
      throw error;
    });
  }
  return ready;
}
