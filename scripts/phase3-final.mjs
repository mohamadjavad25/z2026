
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
const out = {};

// desktop: empty + loiih + owner
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await login("09121112233", "password123");
await load();
await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("فروشگاه")); if (b) b.click(); return !!b; })()'); await sleep(1100);
await ev('(() => { const el = [...document.querySelectorAll(".shopCard")].find(c => (c.innerText || "").includes("گلوری")); if (el) el.click(); return !!el; })()'); await sleep(2300);
out.empty = {
  statsGone: await ev('(() => !document.querySelector(".shopStoreStats") && !document.querySelector(".shopStoreFollowers") === false ? "followers-ok" : "check")()') !== "check",
  hscroll: await ev('({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })'),
  followers: await ev('(() => document.querySelector(".shopStoreFollowers")?.innerText?.trim().slice(0, 30) || null)()')
};
await snap("p3-final-empty");

// loiih with cart
await ev('(() => { const b = document.querySelector(".shopStoreBackButton"); if (b) b.click(); return !!b; })()'); await sleep(1100);
await ev('(() => { const el = [...document.querySelectorAll(".shopCard")].find(c => (c.innerText || "").includes("loiih")); if (el) el.click(); return !!el; })()'); await sleep(2300);
await ev('(() => { const b = document.querySelector(".shopStoreProduct .shopStoreProductMeta button"); if (b) b.click(); return !!b; })()'); await sleep(1000);
out.loiih = {
  dockCartBg: await ev('(() => { const c = document.querySelector(".shopStoreDockCart"); return c ? getComputedStyle(c).backgroundImage.slice(0, 30) : null; })()'),
  dockIcon: await ev('(() => { const i = document.querySelector(".shopStoreDockIcon"); return i ? getComputedStyle(i).color : null; })()'),
  hscroll: await ev('({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })')
};
await snap("p3-final-loiih");

// owner
await ev('fetch("/api/auth/logout", { method: "POST" }).catch(() => null)');
await login("09124445566", "password123");
await load();
await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("فروشگاه")); if (b) b.click(); return !!b; })()'); await sleep(1100);
await ev('(() => { const el = [...document.querySelectorAll(".shopCard")].find(c => (c.innerText || "").includes("گلوری")); if (el) el.click(); return !!el; })()'); await sleep(2300);
out.owner = {
  noDock: await ev('(() => !document.querySelector(".shopStoreDock"))()'),
  followersShown: await ev('(() => document.querySelector(".shopStoreFollowers")?.innerText?.trim().slice(0, 30) || null)()'),
  hscroll: await ev('({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })')
};
await snap("p3-final-owner");

// mobile
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true, screenWidth: 390, screenHeight: 844 });
await login("09121112233", "password123");
await load();
await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("فروشگاه")); if (b) b.click(); return !!b; })()'); await sleep(1100);
await ev('(() => { const el = [...document.querySelectorAll(".shopCard")].find(c => (c.innerText || "").includes("گلوری")); if (el) el.click(); return !!el; })()'); await sleep(2300);
out.mobile = {
  hscroll: await ev('({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })'),
  dockVisible: await ev('(() => { const d = document.querySelector(".shopStoreDock"); return d ? Math.round(d.getBoundingClientRect().width) : null; })()')
};
await snap("p3-final-mobile");
out.consoleErrors = errors;
console.log(JSON.stringify(out, null, 1));
ws.close();
