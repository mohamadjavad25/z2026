/**
 * Step-2 deep verification: forms, cards, owner panels, h-scroll, console.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const PORT = 9333;
const OUT = "shots/verify-step2b";
mkdirSync(OUT, { recursive: true });

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let idc = 0;
const pending = new Map();
const consoleErrors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === "Runtime.exceptionThrown") {
    consoleErrors.push("EXC: " + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || "").slice(0, 300));
  }
  if (m.method === "Runtime.consoleAPICalled" && (m.params.type === "error" || m.params.type === "warning")) {
    const txt = (m.params.args || []).map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 250);
    consoleErrors.push(m.params.type.toUpperCase() + ": " + txt);
  }
};
const send = (method, params = {}) => new Promise((resolve) => {
  const id = ++idc; pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
});
const ev = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return "EVAL_ERR: " + (r.result.exceptionDetails.exception?.description || "").slice(0, 250);
  return r.result?.result?.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Runtime.enable");
await send("Log.enable");
await send("Page.enable");
async function snap(name) {
  const s = await send("Page.captureScreenshot", { format: "png" });
  if (s.result?.data) writeFileSync(OUT + "/" + name + ".png", Buffer.from(s.result.data, "base64"));
}
const report = {};

async function login(phone, password) {
  await ev(`fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "${phone}", password: "${password}" }) }).then(r => r.json()).then(j => ({ ok: true, j })).catch(e => ({ err: String(e) }))`);
  await sleep(600);
}
async function load(waitMs = 8000) {
  await send("Page.navigate", { url: "http://localhost:3000/" });
  await sleep(waitMs);
  await ev("document.documentElement.style.scrollBehavior='auto'; document.body.style.scrollBehavior='auto'");
}
async function tapNav(label) {
  return ev(`(() => { const b = [...document.querySelectorAll('.bottomNav button')].find(x => (x.innerText || x.getAttribute('aria-label') || '').includes(${JSON.stringify(label)})); if (!b) return false; b.click(); return true; })()`);
}

const CHECKS = `(() => {
  const rect = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height), inFrame: r.left >= 480 && r.right <= 960 };
  };
  const out = {
    hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  };
  return out;
})()`;

const FRAME = { left: 490, right: 950 }; // 460 centered in 1440

function inFrame(r) {
  return r && r.x >= FRAME.left - 2 && r.x + r.w <= FRAME.right + 2;
}

// ── DESKTOP: client deep check ──
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await login("09121112233", "password123");
await load();

// feed cards
await tapNav("اکسپلور"); await sleep(1200);
const feed = await ev(`(() => {
  const cards = [...document.querySelectorAll('.feedCard')].map(c => { const r = c.getBoundingClientRect(); return { x: Math.round(r.x), w: Math.round(r.width) }; });
  const rail = document.querySelector('.categoryRail')?.getBoundingClientRect();
  return { hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, cards: cards.slice(0, 4), catRail: rail ? { x: Math.round(rail.x), w: Math.round(rail.width) } : null };
})()`);
report.feedCards = feed;
await snap("cards-feed");

// salons cards
await tapNav("سالن"); await sleep(1200);
const salonCards = await ev(`(() => {
  const rows = [...document.querySelectorAll('.salonRow')].map(c => { const r = c.getBoundingClientRect(); return { x: Math.round(r.x), w: Math.round(r.width) }; });
  return { hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, rows };
})()`);
report.salonCards = salonCards;
await snap("cards-salon");

// booking modal fields
await ev(`(() => { const el = document.querySelector('.salonRow'); if (el) el.click(); return !!el; })()`);
await sleep(2200);
await ev(`(() => { const b = [...document.querySelectorAll('.salonClientBookingModal button, .salonPublicProfile button')].find(x => /رزرو|نوبت/.test(x.innerText||'') || x.classList.contains('is-primary')); if (b) b.click(); return !!b; })()`);
await sleep(1500);
const booking = await ev(`(() => {
  const m = document.querySelector('.salonClientBookingModal');
  if (!m) return { open: false };
  const r = m.getBoundingClientRect();
  const fields = [...m.querySelectorAll('input, select, button')].map(f => { const fr = f.getBoundingClientRect(); return { t: (f.tagName), w: Math.round(fr.width), inside: fr.left >= r.left && fr.right <= r.right }; }).slice(0, 12);
  const hScroll = m.scrollWidth > m.clientWidth + 1;
  return { open: true, rect: { x: Math.round(r.x), w: Math.round(r.width) }, fields, hScroll };
})()`);
report.booking = booking;
await snap("booking-modal");

// guest signup form fields
await ev(`fetch("/api/auth/logout", { method: "POST" }).then(() => true)`);
await load(6000);
await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.innerText||'').includes('ثبت‌نام کن')); if (b) b.click(); return !!b; })()`);
await sleep(1200);
await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.innerText||'').includes('بانو')); if (b) b.click(); return !!b; })()`);
await sleep(1200);
const signup = await ev(`(() => {
  const inputs = [...document.querySelectorAll('input, select')].map(f => { const r = f.getBoundingClientRect(); return { ph: f.getAttribute('placeholder') || f.tagName, w: Math.round(r.width), x: Math.round(r.x), inside: r.left >= 480 && r.right <= 960 }; });
  const hScroll = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  return { inputs, hScroll };
})()`);
report.signup = signup;
await snap("signup-form");

// ── DESKTOP owner roles ──
async function ownerCheck(label, phone) {
  await login(phone, "password123");
  await load();
  const c = await ev(CHECKS);
  await snap("owner-" + label);
  return c;
}
report.shopOwner = await ownerCheck("shop", "09124445566");
report.salonOwner = await ownerCheck("salon", "09123334455");
report.artistOwner = await ownerCheck("artist", "09122223344");

// ── MOBILE real: client + owner ──
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await login("09121112233", "password123");
await load();
const mClient = await ev(CHECKS);
await tapNav("سالن"); await sleep(1200);
const mSalons = await ev(CHECKS);
await tapNav("فروشگاه"); await sleep(1200);
const mShops = await ev(CHECKS);
report.mobile = { client: mClient, salons: mSalons, shops: mShops };
await snap("mobile-client");
await login("09124445566", "password123");
await load();
report.mobile.shopOwner = await ev(CHECKS);
await snap("mobile-shop");

report.consoleErrors = consoleErrors.filter((e) => !/salon-collabs/.test(e));
writeFileSync(OUT + "/report.json", JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
ws.close();
