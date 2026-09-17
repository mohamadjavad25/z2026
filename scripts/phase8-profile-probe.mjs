
import { writeFileSync } from "node:fs";
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let idc = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve({ timeout: true }); } }, 15000); });
const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.timeout) return "TIMEOUT"; if (r.result?.exceptionDetails) return "EVAL_ERR"; return r.result?.result?.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Runtime.enable");
async function login(phone, password) { await ev('fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "' + phone + '", password: "' + password + '" }) }).then(r => r.json()).catch(e => ({ err: String(e) }))'); await sleep(800); }
async function load() { await send("Page.navigate", { url: "http://localhost:3000/" }); await sleep(20000); await ev("document.documentElement.style.scrollBehavior='auto'"); }
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

// ARTIST profile
await login("09122223344", "password123");
await load();
await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("پروفایل")); if (b) b.click(); return !!b; })()');
await sleep(2500);
console.error("ARTIST:", await ev('(() => ({ hero: !!document.querySelector(".profileHero"), wrap: !!document.querySelector(".profileStoryAvatarWrap"), creator: !!document.querySelector(".profileStoryAvatarWrap .salonHeroStoryCreateIcon"), panels: [...document.querySelectorAll(".profilePanel .page-*")].length, heroClass: document.querySelector(".profileHero")?.className?.slice(0, 80) }))()'));

// SHOP owner profile
await login("09124445566", "password123");
await load();
await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("پروفایل")); if (b) b.click(); return !!b; })()');
await sleep(2500);
console.error("SHOP-OWNER:", await ev('(() => ({ hero: !!document.querySelector(".profileHero"), dash: !!document.querySelector(".shopOwnerMobileDashboard"), wrap: !!document.querySelector(".profileStoryAvatarWrap") }))()'));
ws.close();
console.error("DONE");
