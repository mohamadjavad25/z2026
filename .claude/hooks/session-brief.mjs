#!/usr/bin/env node
// Session-start brief: what changed since the last session and how the live site is doing.
// Printed into Claude's context by the SessionStart hook in .claude/settings.json, so a new
// session knows the current state without reading the long notes. Read-only: it fetches git,
// calls the public health check, and (only where the deploy key exists) reads a few counts
// on the main server. Secrets never leave the server. Every part fails quietly on its own.
import { execFile } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SERVER = "deploy@87.107.130.167";
const STATE_DIR = join(homedir(), ".claude", "frfro");
const STATE_FILE = join(STATE_DIR, "last-brief.json");

function run(cmd, args, timeoutMs = 12000) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs, windowsHide: true, maxBuffer: 1 << 20 }, (err, stdout) =>
      resolve(err ? null : stdout.trim()),
    );
  });
}
const git = (...args) => run("git", args);

async function live() {
  const out = {};
  try {
    const res = await fetch("https://frfro.ir/api/health", { signal: AbortSignal.timeout(8000) });
    out.health = res.ok ? "up" : `HTTP ${res.status}`;
  } catch {
    out.health = "unreachable from this machine";
  }
  if (!existsSync(join(homedir(), ".ssh", "frfro-deploy"))) return out;
  const q =
    "select (select count(*) from users where created_at>now()-interval '24 hours')," +
    "(select count(*) from users)," +
    "(select count(*) from salon_bookings where created_at>now()-interval '24 hours')+" +
    "(select count(*) from artist_bookings where created_at>now()-interval '24 hours')," +
    "(select count(*) from client_errors where created_at>now()-interval '24 hours')";
  const remote = `readlink /opt/frfro/current; systemctl is-active frfro; psql "$(sudo -n /opt/frfro/bin/db-url.sh)" -Atc "${q}" 2>/dev/null`;
  const ssh = await run("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=6", SERVER, remote], 15000);
  if (!ssh) return out;
  const [release, active, counts] = ssh.split("\n");
  out.release = release?.split("/").pop();
  out.service = active;
  if (counts) {
    const [newUsers, users, bookings, errors] = counts.split("|");
    out.counts = { newUsers, users, bookings, errors };
  }
  return out;
}

// Last finished CI run on main (needs the gh CLI; quiet without it). A red main means nothing new is proven to
// work, so the session must say so first (lesson 2026-11-03: main was red for days and nobody noticed).
async function ciOnMain() {
  const out = await run("gh", ["run", "list", "--workflow", "ci.yml", "--branch", "main", "--limit", "10",
    "--json", "conclusion,status,headSha,createdAt,url"], 15000);
  if (!out) return null;
  let runs;
  try { runs = JSON.parse(out); } catch { return null; }
  const done = runs.filter((r) => r.status === "completed");
  if (!done.length) return null;
  const last = done[0];
  const green = done.findIndex((r) => r.conclusion === "success");
  const sha = last.headSha.slice(0, 8);
  if (last.conclusion === "success") return `CI on main: green (${sha}).`;
  const streak = green === -1 ? `the last ${done.length} finished runs` : `${green} run(s) in a row`;
  return `CI on main: RED (${last.conclusion} on ${sha}, ${streak}; ${last.url}). Tell the owner and fix it before new work.`;
}

async function main() {
  const [, liveState, ci] = await Promise.all([git("fetch", "origin", "--quiet", "--prune"), live(), ciOnMain()]);
  const lines = ["frfro session brief (auto, read-only):"];

  let state = {};
  try { state = JSON.parse(readFileSync(STATE_FILE, "utf8")); } catch {}
  const head = await git("rev-parse", "--short", "origin/main");
  if (head) {
    if (state.mainSha && state.mainSha !== head) {
      const log = await git("log", "--format=  - %h %ad %s", "--date=format:%m-%d", "-n", "10", `${state.mainSha}..origin/main`);
      lines.push(`New on main since the last session (${state.mainSha} -> ${head}):`, log || "  (history rewritten)");
    } else {
      lines.push(`main: ${head}, no new commits since the last session.`);
    }
  }

  if (liveState.release) {
    // Release stamps are the server's clock (Iran time); commits after it are probably not live.
    const m = liveState.release.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})/);
    let notLive = "";
    if (m) {
      const since = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+03:30`;
      const after = await git("rev-list", "--count", `--since=${since}`, "origin/main");
      if (after && after !== "0") notLive = `, ${after} main commit(s) newer than it are probably not live yet`;
    }
    lines.push(`Main server: release ${liveState.release}, service ${liveState.service}, site ${liveState.health}${notLive}.`);
  } else {
    lines.push(`Main server: site ${liveState.health} (no SSH from here).`);
  }
  if (ci) lines.push(ci);
  if (liveState.counts) {
    const c = liveState.counts;
    lines.push(`Last 24h on the live site: ${c.newUsers} new accounts (${c.users} total), ${c.bookings} new bookings, ${c.errors} app error reports.`);
  }

  const branches = await git(
    "for-each-ref", "--sort=-committerdate", "--format=%(refname:short) %(committerdate:unix)",
    "--no-merged=origin/main", "refs/remotes/origin",
  );
  const weekAgo = Date.now() / 1000 - 7 * 86400;
  const recent = (branches || "").split("\n")
    .map((l) => l.split(" "))
    .filter(([name, ts]) => name && name !== "origin/HEAD" && Number(ts) > weekAgo)
    .map(([name]) => name.replace("origin/", ""));
  if (recent.length) lines.push(`Unmerged branches with work this week: ${recent.slice(0, 5).join(", ")}${recent.length > 5 ? ` (+${recent.length - 5})` : ""}.`);

  const branch = await git("branch", "--show-current");
  const counts = await git("rev-list", "--left-right", "--count", "HEAD...origin/main");
  const dirty = await git("status", "--porcelain");
  if (branch !== null) {
    const [ahead, behind] = (counts || "0 0").split(/\s+/);
    const changed = dirty ? dirty.split("\n").length : 0;
    lines.push(`This checkout: ${branch || "detached"}, ${ahead} ahead / ${behind} behind origin/main, ${changed} uncommitted file(s).`);
  }

  // The owner's standing priorities (docs/PRIORITIES.md, 2026-11-04): the first open items, every session.
  try {
    const open = readFileSync(join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), "docs", "PRIORITIES.md"), "utf8").split("\n").filter((l) => l.startsWith("- [ ]"));
    if (open.length) {
      lines.push(`Owner's priorities (docs/PRIORITIES.md, ${open.length} open; continue the first unless the owner asks for something else):`);
      for (const l of open.slice(0, 3)) lines.push(`  ${l.slice(6, 160)}`);
    }
  } catch { /* no priorities file on this branch */ }

  // What we are waiting on (docs/FOLLOWUPS.md, 2026-11-05): every open line, so the owner hears it in any session.
  try {
    const waiting = readFileSync(join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), "docs", "FOLLOWUPS.md"), "utf8").split(/?
/).filter((l) => l.startsWith("- [ ]"));
    if (waiting.length) {
      lines.push(`Follow-ups (docs/FOLLOWUPS.md, ${waiting.length} open; tell the owner where they stand in your first reply):`);
      for (const l of waiting) lines.push(`  ${l.slice(6, 220)}`);
    }
  } catch { /* no follow-ups file on this branch */ }

  console.log(lines.join("\n"));
  if (head) {
    try { mkdirSync(STATE_DIR, { recursive: true }); writeFileSync(STATE_FILE, JSON.stringify({ mainSha: head, at: new Date().toISOString() })); } catch {}
  }
}

main().catch(() => {});
