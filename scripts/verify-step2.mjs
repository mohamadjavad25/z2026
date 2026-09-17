/**
 * Step-2 verification: phone frame on desktop + real mobile, no h-scroll, forms/cards intact.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const PORT = 9333;
const OUT = "shots/verify-step2";
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
  if (m.method === "Log.entryAdded" && (m.params.entry.level === "error" || m.params.entry.level === "warning")) {
    consoleErrors.push("LOG " + m.params.entry.level + ": " + m.params.entry.text.slice(0, 250));
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

const GEOM = `(() => {
  const rect = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), display: s.display, visible: r.width > 1 && r.height > 1 };
  };
  const activePages = [...document.querySelectorAll('.mobilePage.is-active')].map(p => p.className.split(' ').filter(c => c.startsWith('page-')).join(','));
  return {
    vw: innerWidth, vh: innerHeight,
    shell: rect('.appShell'),
    sidebar: rect('.sidebar'),
    bottomNav: rect('.bottomNav'),
    workspace: rect('.workspace'),
    activePages,
    hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    docScrollW: document.documentElement.scrollWidth,
    bodyTextHead: document.body.innerText.slice(0, 120),
  };
})()`;

async function tapNav(label) {
  return ev(`(() => { const b = [...document.querySelectorAll('.bottomNav button')].find(x => (x.innerText || x.getAttribute('aria-label') || '').includes(${JSON.stringify(label)})); if (!b) return false; b.click(); return true; })()`);
}

// ── DESKTOP 1440×900 — client ──
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await login("09121112233", "password123");
await load();
report.desktop = { profile: await ev(GEOM) };
await snap("d1-profile");
await tapNav("اکسپلور"); await sleep(1200);
report.desktop.feed = await ev(GEOM);
await snap("d2-feed");
await tapNav("سالن"); await sleep(1200);
report.desktop.salons = await ev(GEOM);
await snap("d3-salons");
await tapNav("فروشگاه"); await sleep(1200);
report.desktop.shops = await ev(GEOM);
await snap("d4-shops");
await tapNav("چت"); await sleep(1200);
report.desktop.chat = await ev(GEOM);
await snap("d5-chat");

// open salon detail + booking modal on desktop
await tapNav("سالن"); await sleep(1200);
await ev(`(() => { const el = document.querySelector('.salonRow'); if (el) el.click(); return !!el; })()`);
await sleep(2000);
report.desktop.salonDetail = await ev(GEOM);
await snap("d6-salon-detail");
await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.innerText||'').trim() === 'رزرو' && x.offsetParent); if (b) b.click(); return !!b; })()`);
await sleep(1500);
report.desktop.bookingModal = await ev(GEOM);
await snap("d7-booking");

// guest signup form on desktop
await ev(`fetch("/api/auth/logout", { method: "POST" }).then(() => true)`);
await load(6000);
report.desktop.guest = await ev(GEOM);
await snap("d8-guest");
await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.innerText||'').includes('ثبت‌نام کن')); if (b) b.click(); return !!b; })()`);
await sleep(1200);
report.desktop.signup = await ev(GEOM);
await snap("d9-signup");

// ── MOBILE 390×844 — client ──
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await login("09121112233", "password123");
await load();
report.mobile = { profile: await ev(GEOM) };
await snap("m1-profile");
await tapNav("اکسپلور"); await sleep(1200);
report.mobile.feed = await ev(GEOM);
await snap("m2-feed");
await tapNav("سالن"); await sleep(1200);
await ev(`(() => { const el = document.querySelector('.salonRow'); if (el) el.click(); return !!el; })()`);
await sleep(2000);
report.mobile.salonDetail = await ev(GEOM);
await snap("m3-salon");

// ── SHOP owner on desktop (full-screen dashboard in frame) ──
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await login("09124445566", "password123");
await load();
report.desktop.shop = await ev(GEOM);
await snap("d10-shop");

report.consoleErrors = consoleErrors.filter((e) => !/salon-collabs/.test(e));
writeFileSync(OUT + "/report.json", JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
ws.close();
