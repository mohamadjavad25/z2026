import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { execSync, spawn } from "node:child_process";

/**
 * Vitest globalSetup: runs once, before any test file. Starts a real
 * Postgres 16 container, applies every migration to it via the actual
 * `npm run migrate` path (not a hand-rolled schema shortcut -- this is
 * what proves the migrations themselves are correct), then boots the
 * actual built app (`next start`) against that database and drives tests
 * through real HTTP requests against it.
 *
 * Deliberately not calling route handlers directly with a mocked Request:
 * this app's auth (requireUser/getUserFromRequest) reads the session
 * cookie via NextRequest's cookie parsing, which a plain Web API Request
 * doesn't replicate correctly -- a real running server sidesteps that
 * fragility entirely and is the same methodology used to verify every
 * phase of this rewrite by hand (register/login/booking/etc. via real
 * curl requests against a real `next start`), just automated.
 *
 * Requires `npm run build` to have already produced .next/ -- see the
 * "test" script in package.json, which builds first.
 */
const TEST_PORT = 3100;
export const TEST_CRON_SECRET = "test-cron-secret";
export const TEST_ADMIN_PHONE = "09120000001";
export const TEST_BASE_URL = `http://localhost:${TEST_PORT}`;

let container;
let serverProcess;

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Server at ${url} did not become healthy within ${timeoutMs}ms`);
}

export async function setup() {
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  // Testcontainers' postgres:16-alpine has no TLS listener at all.
  // app/lib/db/connection.js defaults to `ssl: { rejectUnauthorized: false }`
  // (an *attempted* SSL handshake, not "SSL off") unless the connection
  // string it's given contains `sslmode=disable` -- without this, the app
  // server's pool tries to negotiate TLS, the container has nothing to
  // negotiate with, and every query (including /api/health's) fails
  // silently, which just looks like "the server never becomes healthy".
  // node-pg-migrate (invoked below) doesn't apply that same ssl override,
  // which is why migrations succeed even without this flag.
  const connectionString = `${container.getConnectionUri()}?sslmode=disable`;

  execSync("node scripts/migrate.mjs up", {
    env: { ...process.env, POSTGRES_URL: connectionString },
    stdio: "inherit"
  });

  // Invoke `next start` directly (via npx) rather than `npm run start`:
  // npm spawns `next` as a child of its own process, so killing the npm
  // process in teardown left the real `next-server` grandchild running
  // (visible as an orphaned next-server process after each run). Spawning
  // detached puts this process in its own process group so teardown can
  // signal the whole group at once, in case `next start` itself forks.
  serverProcess = spawn("npx", ["next", "start", "-p", String(TEST_PORT)], {
    env: { ...process.env, POSTGRES_URL: connectionString, NODE_ENV: "production", CRON_SECRET: TEST_CRON_SECRET, ZIBABAN_ADMIN_PHONES: TEST_ADMIN_PHONE, ZIBABAN_REMINDER_TEST_CLOCK: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true
  });
  let serverOutput = "";
  serverProcess.stdout.on("data", (chunk) => { serverOutput += chunk.toString(); });
  serverProcess.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });
  serverProcess.on("error", (err) => {
    throw new Error(`Failed to start test server: ${err.message}`);
  });

  try {
    await waitForServer(TEST_BASE_URL, 30_000);
  } catch (err) {
    console.error("--- test server output ---\n" + serverOutput);
    throw err;
  }

  process.env.TEST_BASE_URL = TEST_BASE_URL;
}

export async function teardown() {
  if (serverProcess?.pid) {
    try {
      // Negative pid targets the whole detached process group (the
      // `next start` process and anything it forked), not just the direct
      // child -- a plain serverProcess.kill() only signals the direct
      // child and left orphaned next-server processes behind.
      process.kill(-serverProcess.pid, "SIGTERM");
    } catch {
      // already exited
    }
  }
  await container?.stop();
}
