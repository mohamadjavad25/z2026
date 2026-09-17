
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
  if (m.method === "Runtime.exceptionThrown") errors.push("EXC: " + (m.params.exceptionDetails?.exception?.description || "").slice(0, 180));
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("ERR: " + (m.params.args || []).map(a => a.value ?? a.description ?? "").join(" ").slice(0, 180));
};
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) return "EVAL_ERR: " + (r.result.exceptionDetails.exception?.description || "").slice(0, 180); return r.result?.result?.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Runtime.enable");
async function snap(name) { const s = await send("Page.captureScreenshot", { format: "png" }); if (s.result?.data) writeFileSync("shots/phase3/" + name + ".png", Buffer.from(s.result.data, "base64")); }
async function login(phone, password) { await ev('fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "' + phone + '", password: "' + password + '" }) }).then(r => r.json()).catch(e => ({ err: String(e) }))'); await sleep(600); }
async function load() { await send("Page.navigate", { url: "http://localhost:3000/" }); await sleep(6500); await ev("document.documentElement.style.scrollBehavior='auto'"); }
async function openShop(name) {
  await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("فروشگاه")); if (b) b.click(); return !!b; })()'); await sleep(1100);
  await ev('(() => { const el = [...document.querySelectorAll(".shopCard")].find(c => (c.innerText || "").includes(' + JSON.stringify(name) + ')); if (el) el.click(); return !!el; })()'); await sleep(2300);
}
const out = {};
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await login("09121112233", "password123");
await load();
await openShop("گلوری");

out.logo = await ev('(() => { const l = document.querySelector(".shopStoreLogo"); const cs = getComputedStyle(l); return { border: cs.borderWidth, cursor: cs.cursor, role: l.getAttribute("role"), tabindex: l.getAttribute("tabindex") }; })()');
out.rail = await ev('(() => { const r = document.querySelector(".shopStoreStoryRail"); return r ? { exists: true, opacity: getComputedStyle(r).opacity } : { exists: false }; })()');
out.storefrontClasses = await ev('(() => document.querySelector(".shopStorefront").className)()');

// click logo → story empty opens
await ev('(() => { const l = document.querySelector(".shopStoreLogo"); l.click(); return true; })()');
await sleep(600);
out.afterClick = {
  classes: await ev('(() => document.querySelector(".shopStorefront").className)()'),
  emptyTxt: await ev('(() => document.querySelector(".shopStoreStoryEmpty")?.innerText?.trim().slice(0, 80) || null)()'),
  railOpacity: await ev('(() => getComputedStyle(document.querySelector(".shopStoreStoryRail")).opacity)()')
};
await snap("p7-story-empty");

// close via clicking the empty card area? The salon closes via drag right; simulate Escape-like: click story empty? Just verify open state renders, then reload
await load();
await openShop("loiih");
out.loiih = {
  logo: await ev('(() => { const l = document.querySelector(".shopStoreLogo"); const cs = getComputedStyle(l); return { border: cs.borderWidth, cursor: cs.cursor }; })()'),
  hscroll: await ev('({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })')
};
await snap("p7-loiih");

// mobile
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true, screenWidth: 390, screenHeight: 844 });
await load();
await openShop("گلوری");
await ev('(() => { const l = document.querySelector(".shopStoreLogo"); l.click(); return true; })()');
await sleep(600);
out.mobile = {
  emptyTxt: await ev('(() => document.querySelector(".shopStoreStoryEmpty")?.innerText?.trim().slice(0, 60) || null)()'),
  railVisible: await ev('(() => getComputedStyle(document.querySelector(".shopStoreStoryRail")).opacity)()'),
  hscroll: await ev('({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })')
};
await snap("p7-story-mobile");
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
ws.close();
