#!/usr/bin/env node
// Thin wrapper around node-pg-migrate's CLI that resolves this app's
// Postgres connection string the same way app/lib/db/connection.js does
// (POSTGRES_URL_NON_POOLING preferred -- migrations run DDL and need a
// direct connection or a session-mode pooler, not Supavisor's
// transaction-mode pooler -- falling back to POSTGRES_URL/DATABASE_URL for
// environments with only one connection string, e.g. local dev).
// node-pg-migrate itself only reads a single named env var, so this sets
// DATABASE_URL from whichever of those is actually set before invoking it.
//
// TLS mirrors connection.js: with PGSSL_CA_PATH (or inline PGSSL_CA) the
// connection is fully verified (`sslmode=verify-full` against that CA);
// `sslmode=disable` in the URL turns TLS off for local Postgres; with
// neither, it falls back to `no-verify` with a warning (Supabase's chain is
// not in Node's default trust store, so a plain `require` would fail).
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Local dev: pick up .env.local like `next dev` does (real env vars win --
// loadEnvFile never overrides variables that are already set).
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// MIGRATE_DATABASE_URL wins over everything: Vercel's Supabase integration
// manages POSTGRES_URL_NON_POOLING itself (read-only, and it points at the
// IPv6-only direct host, unreachable from Vercel's IPv4 builders), so a
// session-mode pooler URL for migrations goes in this separate variable.
const rawConnectionString =
  process.env.MIGRATE_DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  "";

if (!rawConnectionString) {
  console.error(
    "No Postgres connection string configured. Set POSTGRES_URL_NON_POOLING (preferred for migrations), POSTGRES_URL, or DATABASE_URL."
  );
  process.exit(1);
}

function caFilePath() {
  if (process.env.PGSSL_CA_PATH) return resolve(process.env.PGSSL_CA_PATH);
  if (process.env.PGSSL_CA) {
    const file = join(mkdtempSync(join(tmpdir(), "pgssl-")), "ca.crt");
    writeFileSync(file, process.env.PGSSL_CA);
    return file;
  }
  return "";
}

function withSsl(connString) {
  let url;
  try {
    url = new URL(connString);
  } catch {
    return connString;
  }
  if (url.searchParams.get("sslmode") === "disable") return connString;
  url.searchParams.delete("sslmode");
  url.searchParams.delete("sslrootcert");
  const caPath = caFilePath();
  if (caPath) {
    url.searchParams.set("sslmode", "verify-full");
    url.searchParams.set("sslrootcert", caPath);
  } else {
    console.warn(
      "WARNING: PGSSL_CA_PATH/PGSSL_CA not set -- migrating over TLS WITHOUT certificate verification."
    );
    url.searchParams.set("sslmode", "no-verify");
  }
  return url.toString();
}

const args = process.argv.slice(2);
const result = spawnSync("node-pg-migrate", args, {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: withSsl(rawConnectionString) }
});
process.exit(result.status ?? 1);
