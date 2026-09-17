
import { writeFileSync } from "node:fs";
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let idc = 0; const pending = new Map();
const errors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === "Runtime.exceptionThrown") errors.push("EXC");
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("ERR");
};
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) return "EVAL_ERR"; return r.result?.result?.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Runtime.enable");
async function snap(name) { const s = await send("Page.captureScreenshot", { format: "png" }); if (s.result?.data) writeFileSync("shots/phase3/" + name + ".png", Buffer.from(s.result.data, "base64")); }
async function login(phone, password) { await ev('fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "' + phone + '", password: "' + password + '" }) }).then(r => r.json()).catch(e => ({ err: String(e) }))'); await sleep(600); }
async function load() { await send("Page.navigate", { url: "http://localhost:3000/" }); await sleep(6500); await ev("document.documentElement.style.scrollBehavior='auto'"); }
async function openShop(name) {
  await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("فروشگاه")); if (b) b.click(); return !!b; })()'); await sleep(1100);
  await ev('(() => { const el = [...document.querySelectorAll(".shopCard")].find(c => (c.innerText || "").includes(' + JSON.stringify(name) + ')); if (el) el.click(); return !!el; })()'); await sleep(2300);
}
const info = (sel) => '(() => { const el = document.querySelector(' + JSON.stringify(sel) + '); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), cy: Math.round(r.y + r.height / 2) }; })()';
const out = {};
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await login("09121112233", "password123");
await load();
await openShop("گلوری");
out.desktopEmpty = {
  hero: await ev(info(".shopStoreHero")),
  identity: await ev(info(".shopStoreIdentityCard")),
  logo: await ev(info(".shopStoreLogo")),
  title: await ev(info(".shopStoreTitle")),
  rating: await ev(info(".shopStoreRatingCard")),
  chip: await ev(info(".shopStoreNewChip")),
  actions: await ev(info(".shopStoreActions")),
  followers: await ev(info(".shopStoreFollowers")),
  hscroll: await ev('({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })'),
  belowCardTop: await ev('(() => { const id = document.querySelector(".shopStoreIdentityCard").getBoundingClientRect(); const t = document.querySelector(".shopStoreTitle").getBoundingClientRect(); const r = document.querySelector(".shopStoreRatingCard").getBoundingClientRect(); return { titleGap: Math.round(t.top - id.top), ratingGap: Math.round(r.top - id.top) }; })()')
};
await snap("p5-title-edge-empty");
await ev('(() => { const b = document.querySelector(".shopStoreBackButton"); if (b) b.click(); return !!b; })()'); await sleep(1100);
await openShop("loiih");
out.desktopLoiih = { title: await ev(info(".shopStoreTitle")), rating: await ev(info(".shopStoreRatingCard")), actions: await ev(info(".shopStoreActions")), identity: await ev(info(".shopStoreIdentityCard")) };
await snap("p5-title-edge-loiih");
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true, screenWidth: 390, screenHeight: 844 });
await load();
await openShop("گلوری");
out.mobile = {
  identity: await ev(info(".shopStoreIdentityCard")),
  title: await ev(info(".shopStoreTitle")),
  rating: await ev(info(".shopStoreRatingCard")),
  chip: await ev(info(".shopStoreNewChip")),
  actions: await ev(info(".shopStoreActions")),
  hscroll: await ev('({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })')
};
await snap("p5-title-edge-mobile");
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
ws.close();
