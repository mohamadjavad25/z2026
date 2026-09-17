
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
const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) return "EVAL_ERR"; return r.result?.result?.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Runtime.enable"); await send("Network.enable");
async function snap(name) { const s = await send("Page.captureScreenshot", { format: "png" }); if (s.result?.data) writeFileSync("shots/phase2/" + name + ".png", Buffer.from(s.result.data, "base64")); }
async function login(phone, password) { await ev('fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "' + phone + '", password: "' + password + '" }) }).then(r => r.json()).catch(e => ({ err: String(e) }))'); await sleep(600); }
async function load() { await send("Page.navigate", { url: "http://localhost:3000/" }); await sleep(6500); await ev("document.documentElement.style.scrollBehavior='auto'"); }
async function tapNav(label) { return ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || x.getAttribute("aria-label") || "").includes(' + JSON.stringify(label) + ')); if (!b) return false; b.click(); return true; })()'); }
const out = {};
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

// OWNER dashboard
await login("09124445566", "password123");
await load();
await tapNav("پروفایل"); await sleep(2000);
out.ownerDashboard = {
  present: await ev('(() => !!document.querySelector(".shopOwnerMobileDashboard"))()'),
  hscroll: await ev('({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })'),
  productCards: await ev('(() => document.querySelectorAll(".shopProductCard").length)()')
};
await snap("owner-dashboard");

// CLIENT: explore + profile
await login("09121112233", "password123");
await load();
await tapNav("اکسپلور"); await sleep(1500);
out.explore = await ev('({ cards: document.querySelectorAll(".feedCard").length, hscroll: { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth } })');
await snap("explore");
await tapNav("پروفایل"); await sleep(1800);
out.profile = await ev('({ hscroll: { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth } })');
await snap("client-profile");
out.consoleErrors = errors;
console.log(JSON.stringify(out, null, 1));
ws.close();
