// Starts the app on every CPU core: one copy of Next's standalone server per core, all sharing one
// port through Node's cluster module, which hands each new connection to the next copy in turn. A
// single copy uses one core only (load test of 2026-10-29 on the main server: one core full while
// the other sat idle). A bigger server gets more copies with nothing to change by hand.
//
// deploy/deploy.sh renames Next's own server.js to next-server.js and puts this file in its place, so
// the systemd unit (ExecStart=.../server.js) and a rollback to an older release work unchanged.
//
// Nothing a copy keeps in memory is needed by the others: sessions, rate limits and bookings live in
// Postgres; the short in-memory caches are simply kept once per copy.
//
// Env: FRFRO_INSTANCES (copies; default one per core), PGPOOL_MAX (database connections per copy;
// default FRFRO_DB_CONNECTIONS split over the copies), FRFRO_DB_CONNECTIONS (all copies together,
// default 60: Postgres allows 100 and backups, cron and psql need a few). PORT and HOSTNAME pass
// through to every copy.
import cluster from "node:cluster";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const count = Math.max(1, Number(process.env.FRFRO_INSTANCES) || os.availableParallelism());
const dbTotal = Math.max(10, Number(process.env.FRFRO_DB_CONNECTIONS) || 60);
const poolPerCopy = Number(process.env.PGPOOL_MAX) || Math.max(5, Math.floor(dbTotal / count));

cluster.setupPrimary({ exec: path.join(here, "next-server.js"), cwd: here });

let stopping = false;
const recentExits = [];

function startCopy() {
  cluster.fork({ PGPOOL_MAX: String(poolPerCopy) });
}

cluster.on("exit", (worker, code, signal) => {
  if (stopping) return;
  // A copy that stopped is replaced; the others keep serving meanwhile. If copies keep dying
  // (a broken build or a bad env), stop altogether so systemd shows the failure instead of looping.
  const now = Date.now();
  recentExits.push(now);
  while (recentExits.length && now - recentExits[0] > 60_000) recentExits.shift();
  console.error(`app copy ${worker.process.pid} stopped (${signal || code}); starting a new one`);
  if (recentExits.length > count * 5) {
    console.error("app copies keep stopping; giving up so systemd reports it");
    process.exit(1);
  }
  setTimeout(startCopy, 1000);
});

function shutdown(signal) {
  stopping = true;
  cluster.on("exit", () => {
    if (!Object.keys(cluster.workers).length) process.exit(0);
  });
  for (const worker of Object.values(cluster.workers)) worker.process.kill(signal);
  setTimeout(() => process.exit(0), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

console.log(`starting ${count} app copies, ${poolPerCopy} database connections each`);
for (let i = 0; i < count; i++) startCopy();
