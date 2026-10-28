import { describe, it, expect, afterAll } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { createClient, registerUser } from "./helpers.js";
import { TEST_BASE_URL } from "../globalSetup.js";

/** Chaos round 3: a fuzzer that throws junk at every non-admin route as a client, an artist and a salon, and lists every 5xx. */
const note = (...args) => console.log("[chaos]", ...args);
const ROOT = join(process.cwd(), "app/api");

function routes() {
  const found = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name === "route.js") {
        const rel = "/api/" + dir.slice(ROOT.length + 1).replace(/\\/g, "/");
        if (/\/admin|\/cron|billing\/sandbox|auth\/logout/.test(rel)) continue;
        const methods = [...readFileSync(full, "utf8").matchAll(/export const (GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]);
        for (const method of methods) found.push({ path: rel.replace(/\[[^\]]+\]/g, "1"), method });
      }
    }
  };
  walk(ROOT);
  return found.filter((r) => !(r.method === "DELETE" && r.path === "/api/profile"));
}

const FIELDS = ["id", "userId", "targetUserId", "salonUserId", "artistUserId", "staffId", "serviceId", "bookingId", "postId", "ticketId", "date", "day", "time", "start", "end", "duration", "durationMin", "price", "name", "title", "text", "body", "message", "caption", "bio", "status", "phone", "code", "q", "plan", "tag", "area", "service", "image", "avatar", "services", "parts", "items", "hours", "slots", "answer", "reason", "note", "page", "limit", "offset", "category", "kind", "type", "from", "to", "lat", "lng", "address", "endpoint", "token", "keys"];
const NASTY = [null, "", "a\u0000b", -1, 0, 1e21, 2 ** 53, "abc", [], {}, true, "x".repeat(70_000), "' OR 1=1--", "۱۲۳۴", "9999-99-99", [null, [[]]], { a: { b: { c: 1 } } }, "‮\ud800"];

const post = async (client, route, body) => {
  const res = await fetch(`${TEST_BASE_URL}${route.path}${route.method === "GET" ? `?${new URLSearchParams(Object.fromEntries(Object.entries(body).filter(([, v]) => ["string", "number", "boolean"].includes(typeof v)).map(([k, v]) => [k, String(v).slice(0, 2000)]))).toString()}` : ""}`, {
    method: route.method,
    headers: { "Content-Type": "application/json", Cookie: client.cookie() },
    body: route.method === "GET" ? undefined : JSON.stringify(body)
  });
  await res.text().catch(() => "");
  return res.status;
};

describe("fuzz every route", () => {
  // The fuzzer fills the support form's hourly quota (kept per address, and every test call comes from this machine);
  // clear it afterwards so the support tests that run later start with a fresh one.
  afterAll(async () => {
    const db = new pg.Client({ connectionString: process.env.TEST_POSTGRES_URL });
    await db.connect();
    await db.query("DELETE FROM rate_limit_hits WHERE key LIKE 'support%'");
    await db.end();
  });

  for (const role of ["client", "artist", "salon"]) {
    it(`as ${role}: no 5xx anywhere`, async () => {
      const client = createClient();
      await registerUser(client, { type: role, name: `فاز ${role} ${Math.random().toString(36).slice(2, 6)}` });
      const bad = new Map();
      for (const route of routes()) {
        const bodies = [{}, ...NASTY.map((v) => Object.fromEntries(FIELDS.map((f) => [f, v]))), ...NASTY.map((v) => ({ [FIELDS[Math.floor(Math.random() * FIELDS.length)]]: v }))];
        for (const body of bodies) {
          let status;
          try { status = await post(client, route, body); } catch (e) { status = `net:${e.cause?.code || e.message}`; }
          if ((typeof status === "number" && status >= 500) || typeof status === "string") {
            const key = `${route.method} ${route.path}`;
            if (!bad.has(key)) bad.set(key, { status, sample: JSON.stringify(body).slice(0, 160) });
          }
        }
        // a route may have logged the user out or deleted the account; make sure the next one still runs as this role
        const me = await fetch(`${TEST_BASE_URL}/api/auth/me`, { headers: { Cookie: client.cookie() } });
        if (me.status === 401) { note(`${role}: session lost after ${route.method} ${route.path}`); await registerUser(client, { type: role, name: `فاز ${role} ${Math.random().toString(36).slice(2, 8)}` }); }
      }
      note(`${role} 5xx routes:`, bad.size);
      for (const [key, v] of bad) note(`  ${key} -> ${v.status}  e.g. ${v.sample}`);
      expect([...bad.keys()]).toEqual([]);
    }, 600_000);
  }
});
