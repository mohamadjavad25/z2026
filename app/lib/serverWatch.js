import os from "node:os";
import { statfs, readFile } from "node:fs/promises";
import { getDb, get } from "./db/connection.js";
import * as store from "./db/repos/adminNews.js";
import { alertAdmins, tehranClock } from "./adminNews.js";
import { toPersianDigits } from "../shared/lib/digits.js";

/**
 * The server watch, run every 5 minutes by /api/cron/admin-watch: reads the machine's load, disk and memory, how long
 * the site takes to answer, and whether SMS is going out, and tells the operator's app when something needs them
 * (owner's decisions of 2026-10-29). The limits come from the load test of the same day (docs/HEALTH.md «ظرفیت»):
 * the processor full means the ~120 answers a second ceiling is near. Busy days are remembered, and three in a row
 * say plainly that it is time for a bigger server. It cannot tell that the whole server is off: that needs the outside
 * uptime monitor (docs/OPERATIONS.md).
 */

export const LIMITS = { cpu: 0.8, slowMs: 2000, disk: 0.8, memoryFree: 0.1, smsFailures: 3, strikes: 2 };
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const pct = (ratio) => `${toPersianDigits(String(Math.round(ratio * 100)))}٪`;
const secs = (ms) => toPersianDigits((ms / 1000).toFixed(1).replace(/\.0$/, ""));

async function memoryFreeRatio() {
  try {
    const text = await readFile("/proc/meminfo", "utf8");
    const value = (name) => Number(text.match(new RegExp(`^${name}:\\s+(\\d+)`, "m"))?.[1] || 0);
    if (value("MemTotal")) return value("MemAvailable") / value("MemTotal");
  } catch {
    // not Linux: fall back to Node's own numbers
  }
  return os.freemem() / os.totalmem();
}

async function diskUsedRatio() {
  try {
    const fs = await statfs("/");
    return fs.blocks ? 1 - fs.bavail / fs.blocks : 0;
  } catch {
    return 0;
  }
}

/** SMS sends in the last 15 minutes that failed while none went out (empty credit, a blocked line, a wrong key). */
async function smsFailures() {
  try {
    const db = await getDb();
    const row = await get(db, `
      SELECT COUNT(*) FILTER (WHERE status = 'failed')::int AS failed, COUNT(*) FILTER (WHERE status = 'sent')::int AS sent
      FROM sms_log WHERE created_at >= NOW() - INTERVAL '15 minutes' AND provider <> 'test' AND detail NOT LIKE '%not configured%'
    `);
    return row?.sent ? 0 : Number(row?.failed || 0);
  } catch {
    return 0;
  }
}

/** How long the site's own health check takes from inside the machine, in ms (Infinity when it does not answer). */
async function answerMs(origin) {
  const started = Date.now();
  try {
    const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
    return response.ok ? Date.now() - started : Infinity;
  } catch {
    return Infinity;
  }
}

export async function readServer(origin) {
  const cores = os.availableParallelism?.() || os.cpus().length || 1;
  const [disk, memoryFree, sms, ms] = await Promise.all([diskUsedRatio(), memoryFreeRatio(), smsFailures(), answerMs(origin)]);
  return { cpu: os.loadavg()[1] / cores, disk, memoryFree, smsFailures: sms, answerMs: ms };
}

/**
 * Pure: from one reading and the saved state, what to tell and the new state. The processor and the answer time must be
 * bad on two checks in a row (10 minutes) so one heavy minute says nothing.
 */
export function judge(reading, state = {}, now = new Date()) {
  const today = tehranClock(now).day;
  const next = { cpuStrikes: 0, slowStrikes: 0, busyDays: { ...(state.busyDays || {}) } };
  const alerts = [];
  let busyNow = false;

  next.cpuStrikes = reading.cpu >= LIMITS.cpu ? (state.cpuStrikes || 0) + 1 : 0;
  if (next.cpuStrikes === LIMITS.strikes) {
    busyNow = true;
    alerts.push({ key: "busy", title: "سرور داره شلوغ می‌شه", body: `۱۰ دقیقه است پردازنده بالای ${pct(LIMITS.cpu)}ه (الان ${pct(reading.cpu)}). اگه هر روز تکرار شد، وقت ارتقاست.` });
  }
  next.slowStrikes = reading.answerMs >= LIMITS.slowMs ? (state.slowStrikes || 0) + 1 : 0;
  if (next.slowStrikes === LIMITS.strikes) {
    busyNow = true;
    alerts.push({
      key: "slow",
      title: "سایت کند جواب می‌ده",
      body: Number.isFinite(reading.answerMs)
        ? `۱۰ دقیقه است جواب‌ها بیشتر از ${secs(LIMITS.slowMs)} ثانیه طول می‌کشه (الان ${secs(reading.answerMs)} ثانیه).`
        : "سایت از داخل خود سرور هم جواب نمی‌ده. سرویس فرفرو رو چک کن."
    });
  }
  if (busyNow) next.busyDays[today] = (next.busyDays[today] || 0) + 1;
  if (reading.disk >= LIMITS.disk) {
    alerts.push({ key: "disk", gapMs: DAY, title: "دیسک سرور داره پر می‌شه", body: `${pct(reading.disk)} دیسک پره. اگه پر بشه، سایت و بکاپ‌ها می‌خوابن.` });
  }
  if (reading.memoryFree < LIMITS.memoryFree) {
    alerts.push({ key: "memory", title: "حافظهٔ سرور کم اومده", body: `فقط ${pct(reading.memoryFree)} حافظه آزاده. اگه ادامه داشت، سرور با حافظهٔ بیشتر لازمه.` });
  }
  if (reading.smsFailures >= LIMITS.smsFailures) {
    alerts.push({
      key: "sms",
      title: "پیامک‌ها نمی‌رن",
      body: `۱۵ دقیقهٔ گذشته ${toPersianDigits(String(reading.smsFailures))} پیامک نرفت و هیچ‌کدوم نرفت. اعتبار و خط فراز رو چک کن؛ بدون پیامک کسی ثبت‌نام نمی‌کنه.`
    });
  }

  // Keep a week of busy days; three days in a row (today included) = time for a bigger server.
  const days = [0, 1, 2, 3, 4, 5, 6].map((back) => tehranClock(new Date(now.getTime() - back * DAY)).day);
  next.busyDays = Object.fromEntries(Object.entries(next.busyDays).filter(([day]) => days.includes(day)));
  if (busyNow && days.slice(0, 3).every((day) => next.busyDays[day])) {
    alerts.push({ key: "upgrade", gapMs: DAY, title: "وقت سرور بزرگ‌تره", body: "سه روز پشت سر هم سرور شلوغ شده. یه سرور ۴ هسته‌ای بگیر؛ تقریباً دو برابر آدم رو جواب می‌ده." });
  }
  return { alerts, state: next, busyToday: next.busyDays[today] || 0 };
}

/** One watch round: read, judge, tell, save. Returns what it saw and told (for the cron's answer and the log). */
export async function watchServer(origin, now = new Date()) {
  const reading = await readServer(origin);
  const { alerts, state, busyToday } = judge(reading, await store.readState("server"), now);
  await store.writeState("server", state);
  const told = [];
  for (const alert of alerts) {
    if (await alertAdmins(alert.key, alert)) told.push(alert.key);
  }
  return { reading, told, busyToday };
}
