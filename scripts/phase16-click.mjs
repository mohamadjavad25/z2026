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
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("ERR: " + (m.params.args || []).map(a => a.value ?? a.description ?? "").join(" ").slice(0, 130));
};
const send = (method, params = {}) => new Promise((resolve) => { const id = ++idc; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve({ timeout: true }); } }, 15000); });
const ev = async (expression, retries = 1) => { for (let i = 0; i <= retries; i++) { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (!r.timeout) { if (r.result?.exceptionDetails) return "EVAL_ERR"; return r.result?.result?.value; } await new Promise((x) => setTimeout(x, 3000)); } return "TIMEOUT"; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function login(phone, password) { await ev('fetch("/api/auth/logout", { method: "POST" }).catch(() => null)'); await sleep(400); await ev('fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: "' + phone + '", password: "' + password + '" }) }).then(r => r.json()).catch(e => ({ err: String(e) }))'); await sleep(800); }
async function load() { await send("Page.navigate", { url: "http://localhost:3000/" }); await sleep(9000); for (let i = 0; i < 4; i++) { if (await ev("(() => !!document.querySelector('.appShell'))()") === true) break; await sleep(2500); } await ev("document.documentElement.style.scrollBehavior='auto'"); }
const out = {};
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
// ARTIST
await login("09122223344", "password123");
await load();
await ev('(() => { const b = document.querySelector(".bottomNav .profileTab"); if (b) b.click(); return !!b; })()');
await sleep(3000);
out.artistBtn = await ev('(() => !!document.querySelector(".profileStoryAvatarWrap .salonHeroStoryCreateIcon"))()');
await ev('(() => { const w = document.querySelector(".profileStoryAvatarWrap"); if (w) w.click(); return !!w; })()');
await sleep(800);
out.artistOverlay = await ev('(() => document.querySelector(".salonStoryCreatorHead span")?.innerText?.trim() || null)()');
// close
await ev('(() => { const b = document.querySelector(".salonStoryCreatorClose"); if (b) b.click(); return !!b; })()');
await sleep(500);
// SALON
await login("09123334455", "password123");
await load();
await ev('(() => { const b = document.querySelector(".bottomNav .profileTab"); if (b) b.click(); return !!b; })()');
await sleep(3000);
out.salonBtn = await ev('(() => !!document.querySelector(".salonHeroAvatarFrame .salonHeroStoryCreateIcon"))()');
await ev('(() => { const f = document.querySelector(".salonHeroAvatarFrame"); if (f) f.click(); return !!f; })()');
await sleep(800);
out.salonOverlay = await ev('(() => document.querySelector(".salonStoryCreatorHead span")?.innerText?.trim() || null)()');
await ev('(() => { const b = document.querySelector(".salonStoryCreatorClose"); if (b) b.click(); return !!b; })()');
await sleep(500);
// SHOP
await login("09124445566", "password123");
await load();
await ev('(() => { const b = document.querySelector(".bottomNav .profileTab"); if (b) b.click(); return !!b; })()');
await sleep(3000);
out.shopBtn = await ev('(() => !!document.querySelector(".shopRefLogoWrap .salonHeroStoryCreateIcon"))()');
await ev('(() => { const w = document.querySelector(".shopRefLogoWrap"); if (w) w.click(); return !!w; })()');
await sleep(800);
out.shopOverlay = await ev('(() => document.querySelector(".salonStoryCreatorHead span")?.innerText?.trim() || null)()');
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
ws.close();
console.error("DONE-MARKER");