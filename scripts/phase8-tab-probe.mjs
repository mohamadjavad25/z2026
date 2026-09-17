
import { writeFileSync } from "node:fs";
const list = await (await fetch("http://127.0.0.1:9333/json/list")).json();
const page = list.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let idc = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve({ timeout: true }); } }, 10000); });
const ev = async (expression, retries = 1) => { for (let i = 0; i <= retries; i++) { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (!r.timeout) { if (r.result?.exceptionDetails) return "EVAL_ERR"; return r.result?.result?.value; } await new Promise((x) => setTimeout(x, 3000)); } return "TIMEOUT"; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await ev('fetch("/api/auth/logout", { method: "POST" }).catch(() => null)');
await ev('fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "09124445566", password: "password123" }) }).then(r => r.json()).catch(e => ({ err: String(e) }))');
await sleep(800);
await send("Page.navigate", { url: "http://localhost:3000/" });
await sleep(10000);
for (let i = 0; i < 4; i++) { if (await ev("(() => !!document.querySelector('.appShell'))()") === true) break; await sleep(2500); }
await ev("document.documentElement.style.scrollBehavior='auto'");
console.error("ACTIVE-TAB:", await ev('(() => [...document.querySelectorAll(".mobilePage.is-active")].map(p => p.className.slice(0, 60)))()'));
console.error("BODY:", await ev('(() => document.body.innerText.slice(0, 80))()'));
await ev('(() => { const b = document.querySelector(".bottomNav .profileTab"); if (b) b.click(); return !!b; })()');
await sleep(3000);
console.error("AFTER-TAP:", await ev('(() => ({ active: [...document.querySelectorAll(".mobilePage.is-active")].map(p => p.className.slice(0, 60)), dash: !!document.querySelector(".shopOwnerMobileDashboard"), hero: !!document.querySelector(".profileHero"), btn: !!document.querySelector(".shopRefLogoWrap .salonHeroStoryCreateIcon") }))()'));
ws.close();
console.error("DONE");
