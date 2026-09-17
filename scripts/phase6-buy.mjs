
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
  if (m.method === "Runtime.exceptionThrown") errors.push("EXC: " + (m.params.exceptionDetails?.exception?.description || "").slice(0, 150));
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("ERR: " + (m.params.args || []).map(a => a.value ?? a.description ?? "").join(" ").slice(0, 150));
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
const info = (sel) => '(() => { const el = document.querySelector(' + JSON.stringify(sel) + '); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })()';
const out = {};
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await login("09121112233", "password123");
await load();

// loiih (has products) — buy button in head, not in actions
await openShop("loiih");
out.loiih = {
  buyInActions: await ev('(() => !!document.querySelector(".shopStoreActions .shopStoreBuyButton"))()'),
  buyInHead: await ev('(() => !!document.querySelector(".shopStoreHeadActions .shopStoreBuyButton"))()'),
  headActions: await ev('(() => { const h = document.querySelector(".shopStoreHeadActions"); if (!h) return null; return [...h.children].map(b => b.innerText.trim().slice(0, 20)); })()'),
  buyRect: await ev(info(".shopStoreHeadActions .shopStoreBuyButton")),
  headRect: await ev(info(".shopStoreSectionHead")),
  actions: await ev('(() => { const a = document.querySelector(".shopStoreActions"); return a ? a.innerText.trim().slice(0, 40) : null; })()'),
  hscroll: await ev('({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })')
};
await snap("p6-buy-head-loiih");

// click buy button → scrolls to products (no error)
out.buyClick = await ev('(() => { const b = document.querySelector(".shopStoreHeadActions .shopStoreBuyButton"); if (!b) return "no-btn"; b.click(); return "clicked"; })()');
await sleep(800);
out.scrollY = await ev('Math.round(window.scrollY)');
await snap("p6-buy-click");

// empty shop (گلوری) — no buy button anywhere, actions = followers + follow
await ev('(() => { const b = document.querySelector(".shopStoreBackButton"); if (b) b.click(); return !!b; })()'); await sleep(1100);
await openShop("گلوری");
out.empty = {
  buyExists: await ev('(() => !!document.querySelector(".shopStoreBuyButton"))()'),
  actionsTxt: await ev('(() => document.querySelector(".shopStoreActions")?.innerText.trim().slice(0, 50) || null)()'),
  hscroll: await ev('({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })')
};
await snap("p6-buy-head-empty");

// mobile
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true, screenWidth: 390, screenHeight: 844 });
await load();
await openShop("loiih");
out.mobile = {
  buyInHead: await ev('(() => !!document.querySelector(".shopStoreHeadActions .shopStoreBuyButton"))()'),
  buyInActions: await ev('(() => !!document.querySelector(".shopStoreActions .shopStoreBuyButton"))()'),
  hscroll: await ev('({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })')
};
await snap("p6-buy-head-mobile");
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
ws.close();
