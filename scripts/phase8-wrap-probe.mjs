
import { writeFileSync } from "node:fs";
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let idc = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve({ timeout: true }); } }, 15000); });
const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.timeout) return "TIMEOUT"; if (r.result?.exceptionDetails) return "EVAL_ERR: " + (r.result.exceptionDetails.exception?.description || "").slice(0, 150); return r.result?.result?.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Runtime.enable");
async function login(phone, password) { await ev('fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "' + phone + '", password: "' + password + '" }) }).then(r => r.json()).catch(e => ({ err: String(e) }))'); await sleep(800); }
async function load() { await send("Page.navigate", { url: "http://localhost:3000/" }); await sleep(18000); await ev("document.documentElement.style.scrollBehavior='auto'"); }
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

// SHOP owner — inspect wrap contents
await login("09124445566", "password123");
await load();
await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("پروفایل")); if (b) b.click(); return !!b; })()');
await sleep(2500);
console.error("WRAP-HTML:", await ev('(() => { const w = document.querySelector(".profileStoryAvatarWrap"); return w ? w.outerHTML.slice(0, 500) : "no-wrap"; })()'));
console.error("HERO-TYPE:", await ev('(() => { const h = document.querySelector(".profileHero"); return h ? h.className : "none"; })()'));

// ARTIST — valid selector
await login("09122223344", "password123");
await load();
await ev('(() => { const b = [...document.querySelectorAll(".bottomNav button")].find(x => (x.innerText || "").includes("پروفایل")); if (b) b.click(); return !!b; })()');
await sleep(2500);
console.error("ARTIST-WRAP:", await ev('(() => { const w = document.querySelector(".profileStoryAvatarWrap"); return w ? w.outerHTML.slice(0, 500) : "no-wrap"; })()'));
console.error("ARTIST-HERO:", await ev('(() => { const h = document.querySelector(".profileHero"); return h ? h.className : "none"; })()'));
ws.close();
console.error("DONE");
