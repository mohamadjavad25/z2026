#!/usr/bin/env node
// Thin wrapper around node-pg-migrate's CLI that resolves this app's
// Postgres connection string the same way app/lib/db/connection.js does
// (POSTGRES_URL_NON_POOLING preferred -- migrations run DDL and need a
// direct connection, not Supavisor's transaction-mode pooler -- falling
// back to POSTGRES_URL/DATABASE_URL for environments with only one
// connection string, e.g. local dev). node-pg-migrate itself only reads
// a single named env var, so this sets DATABASE_URL from whichever of
// those is actually set before invoking it.
import { spawnSync } from "node:child_process";

const connectionString =
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  "";

if (!connectionString) {
  console.error(
    "No Postgres connection string configured. Set POSTGRES_URL_NON_POOLING (preferred for migrations), POSTGRES_URL, or DATABASE_URL."
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const result = spawnSync("node-pg-migrate", args, {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: connectionString }
});
process.exit(result.status ?? 1);
